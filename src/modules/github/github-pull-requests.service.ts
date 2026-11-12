import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  accounts,
  appProfiles,
  githubActivityEvents,
  githubPullRequests,
  githubRepositories,
  userRepositoryAccess,
} from "@/database/schema";
import { parsePullRequestCheckpoint, PullRequestsCheckpoint } from "@/helpers";
import { auth } from "@/modules/auth";

import { GithubSyncCursorService } from "./github-sync-cursor.service";
import { GithubSyncContext } from "./types";

const HISTORY_DAYS = 365;
const OVERLAP_HOURS = 48;
const MAX_PAGES_PER_RUN = 10;
const PAGE_SIZE = 100;
const ELIGIBILITY_VERSION = 1;

interface GithubPullRequest {
  id: number;
  number: number;
  state: "open" | "closed";
  user: { id: number } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
}

export interface GithubPullRequestsSyncResult {
  repositoryId: string;
  pullRequestsFetched: number;
  pullRequestsUpsetter: number;
  eventsUpsetter: number;
  pagesFetched: number;
  mode: "backfill" | "incremental";
  hasMore: boolean;
  completedAt: Date;
}

@Injectable()
export class GithubPullRequestsService {
  constructor(
    @InjectDrizzle()
    private readonly db: NodePgDatabase,
    private readonly githubSyncCursorService: GithubSyncCursorService,
  ) {}

  async sync(
    context: GithubSyncContext,
  ): Promise<GithubPullRequestsSyncResult> {
    if (
      context.resourceType !== "pull_requests" ||
      context.repositoryId === null
    ) {
      throw new Error("INVALID_SYNC_CONTEXT");
    }

    const repositoryId = context.repositoryId;

    const [repository] = await this.db
      .select({
        id: githubRepositories.id,
        fullName: githubRepositories.fullName,
        visibility: githubRepositories.visibility,
        isFork: githubRepositories.isFork,
        syncEnabled: userRepositoryAccess.syncEnabled,
      })
      .from(userRepositoryAccess)
      .innerJoin(
        githubRepositories,
        eq(userRepositoryAccess.repositoryId, githubRepositories.id),
      )
      .where(
        and(
          eq(userRepositoryAccess.userId, context.userId),
          eq(userRepositoryAccess.repositoryId, repositoryId),
          eq(userRepositoryAccess.syncEnabled, true),
        ),
      )
      .limit(1);

    if (!repository) {
      throw new Error("GITHUB_REPOSITORY_NOT_LINKED");
    }

    if (repository.visibility !== "public") {
      throw new Error("GITHUB_PRIVATE_REPOSITORY_UNSUPPORTED");
    }

    const [profile] = await this.db
      .select({
        githubUserId: appProfiles.githubUserId,
      })
      .from(appProfiles)
      .where(eq(appProfiles.userId, context.userId))
      .limit(1);

    if (profile?.githubUserId === null) {
      throw new Error("GITHUB_IDENTITY_INCOMPLETE");
    }

    const expectedAuthorId = BigInt(profile.githubUserId);
    const accessToken = await this.getAccessToken(context.userId);

    const cursor = await this.githubSyncCursorService.getCursor(context);
    const checkpoint = parsePullRequestCheckpoint(cursor?.cursor ?? null);
    const startedAt = new Date();

    const mode =
      checkpoint?.mode ?? (cursor?.lastSuccessAt ? "incremental" : "backfill");

    const since = checkpoint
      ? new Date(checkpoint.since)
      : mode === "backfill"
        ? new Date(startedAt.getTime() - HISTORY_DAYS * 86_400_000)
        : new Date(
            cursor!.lastSuccessAt!.getTime() - OVERLAP_HOURS * 3_600_000,
          );

    const until = checkpoint ? new Date(checkpoint.until) : startedAt;

    const [owner, name, extra] = repository.fullName.split("/");

    if (!owner || !name || extra) {
      throw new Error("INVALID_GITHUB_REPOSITORY_NAME");
    }

    let pullRequestsFetched = 0;
    let pullRequestsUpsetter = 0;
    let eventsUpsetter = 0;
    let pagesFetched = 0;
    let finished = false;

    const firstPage = checkpoint?.nextPage ?? 1;

    for (let offset = 0; offset < MAX_PAGES_PER_RUN; offset++) {
      const page = firstPage + offset;

      const url = new URL(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls`,
      );

      url.searchParams.set("state", "all");
      url.searchParams.set("sort", mode === "backfill" ? "created" : "updated");
      url.searchParams.set("direction", "desc");
      url.searchParams.set("per_page", String(PAGE_SIZE));
      url.searchParams.set("page", String(page));

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "developer-social-api",
        },
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        this.handleGithubError(response);
      }

      const payload: unknown = await response.json();

      if (!Array.isArray(payload)) {
        throw new Error("INVALID_GITHUB_RESPONSE");
      }

      const pullRequests = payload as GithubPullRequest[];

      const hasNext =
        response.headers.get("link")?.includes('rel="next"') ?? false;

      pagesFetched++;
      pullRequestsFetched += pullRequests.length;

      const relevant = pullRequests.filter((pr) => {
        const timestamp = new Date(
          mode === "backfill" ? pr.created_at : pr.updated_at,
        );

        if (!Number.isFinite(timestamp.getTime())) {
          throw new Error("INVALID_GITHUB_PR_DATE");
        }

        return timestamp >= since && timestamp <= until;
      });

      const crossedLowerBound = pullRequests.some(
        (pr) =>
          new Date(mode === "backfill" ? pr.created_at : pr.updated_at) < since,
      );

      // 5. Persistir cada página atomicamente.
      await this.db.transaction(async (tx) => {
        for (const pr of relevant) {
          if (
            !Number.isSafeInteger(pr.id) ||
            !Number.isSafeInteger(pr.number) ||
            !pr.user ||
            !Number.isSafeInteger(pr.user.id)
          ) {
            throw new Error("INVALID_GITHUB_PR_RESPONSE");
          }

          const authorId = BigInt(pr.user.id);

          // Apenas PRs criadas pelo usuário.
          if (authorId !== expectedAuthorId) {
            continue;
          }

          const createdAt = new Date(pr.created_at);
          const closedAt = pr.closed_at ? new Date(pr.closed_at) : null;
          const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;
          const now = new Date();

          const data = {
            githubPrId: BigInt(pr.id),
            repositoryId,
            number: pr.number,
            authorGithubId: authorId,
            state: pr.state,
            createdAt,
            closedAt,
            mergedAt,
            syncedAt: now,
          };

          await tx
            .insert(githubPullRequests)
            .values({
              id: createId(),
              ...data,
            })
            .onConflictDoUpdate({
              target: githubPullRequests.githubPrId,
              set: data,
            });

          pullRequestsUpsetter++;

          await tx
            .insert(githubActivityEvents)
            .values({
              id: createId(),
              userId: context.userId,
              repositoryId,
              sourceType: "pull_request_opened",
              externalKey: String(pr.id),
              githubActorId: authorId,
              occurredAt: createdAt,
              sourceVisibility: repository.visibility,
              isEligible: !repository.isFork,
              eligibilityVersion: ELIGIBILITY_VERSION,
              syncedAt: now,
            })
            .onConflictDoUpdate({
              target: [
                githubActivityEvents.userId,
                githubActivityEvents.sourceType,
                githubActivityEvents.externalKey,
              ],
              set: {
                occurredAt: createdAt,
                sourceVisibility: repository.visibility,
                isEligible: !repository.isFork,
                eligibilityVersion: ELIGIBILITY_VERSION,
                syncedAt: now,
              },
            });

          eventsUpsetter++;
        }
      });

      if (!hasNext || crossedLowerBound || pullRequests.length === 0) {
        finished = true;
        break;
      }

      // 6. Checkpoint após persistir a página.
      await this.githubSyncCursorService.saveCheckpoint(
        context,
        JSON.stringify({
          version: 1,
          kind: "pull-requests",
          mode,
          since: since.toISOString(),
          until: until.toISOString(),
          nextPage: page + 1,
        } satisfies PullRequestsCheckpoint),
      );
    }

    return {
      repositoryId,
      pullRequestsFetched,
      pullRequestsUpsetter,
      eventsUpsetter,
      pagesFetched,
      mode,
      hasMore: !finished,
      completedAt: new Date(),
    };
  }

  private async getAccessToken(userId: string): Promise<string> {
    const [account] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(eq(accounts.userId, userId), eq(accounts.providerId, "github")),
      )
      .limit(1);

    if (!account) {
      throw new Error("GITHUB_ACCOUNT_NOT_LINKED");
    }

    const { accessToken } = await auth.api.getAccessToken({
      body: {
        accountId: account.id,
        userId,
      },
    });

    if (!accessToken) {
      throw new Error("GITHUB_ACCESS_TOKEN_UNAVAILABLE");
    }

    return accessToken;
  }

  private handleGithubError(response: Response): never {
    if (
      response.status === 429 ||
      (response.status === 403 &&
        response.headers.get("x-ratelimit-remaining") === "0")
    ) {
      throw new Error("GITHUB_RATE_LIMIT_EXCEEDED");
    }

    if (response.status === 401) {
      throw new Error("GITHUB_AUTH_INVALID");
    }

    if (response.status === 403 || response.status === 404) {
      throw new Error("GITHUB_REPOSITORY_INACCESSIBLE");
    }

    throw new Error(`GITHUB_API_ERROR_${response.status}`);
  }
}
