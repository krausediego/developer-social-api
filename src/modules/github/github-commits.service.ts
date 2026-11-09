import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { PinoLogger } from "nestjs-pino";

import {
  accounts,
  appProfiles,
  githubActivityEvents,
  githubRepositories,
  userRepositoryAccess,
} from "@/database/schema";
import { auth } from "@/modules/auth";

import { GithubSyncCursorService } from "./github-sync-cursor.service";
import { GithubSyncContext } from "./types";

const INITIAL_HISTORY_DAYS = 365;
const OVERLAP_HOURS = 48;
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const ELIGIBILITY_VERSION = 1;

interface GithubCommit {
  sha: string;
  author: {
    id: number;
  } | null;
  commit: {
    author: {
      date: string | null;
    } | null;
  };
}

export interface GithubCommitsSyncResult {
  repositoryId: string;
  commitsFetched: number;
  eventsUpsetter: number;
  commitsIgnored: number;
  pagesFetched: number;
  completedAt: Date;
}

@Injectable()
export class GithubCommitsService {
  constructor(
    @InjectDrizzle()
    private readonly db: NodePgDatabase,
    private readonly githubSyncCursorService: GithubSyncCursorService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GithubCommitsService.name);
  }

  async sync(context: GithubSyncContext): Promise<GithubCommitsSyncResult> {
    if (context.resourceType !== "commits" || context.repositoryId === null) {
      throw new Error("INVALID_SYNC_CONTEXT");
    }

    const repositoryId = context.repositoryId;

    const [repository] = await this.db
      .select({
        id: githubRepositories.id,
        githubRepoId: githubRepositories.githubRepoId,
        fullName: githubRepositories.fullName,
        defaultBranch: githubRepositories.defaultBranch,
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
        ),
      )
      .limit(1);

    if (!repository) {
      throw new Error("GITHUB_REPOSITORY_NOT_LINKED");
    }

    const emptyResult = (): GithubCommitsSyncResult => ({
      repositoryId,
      commitsFetched: 0,
      eventsUpsetter: 0,
      commitsIgnored: 0,
      pagesFetched: 0,
      completedAt: new Date(),
    });

    if (!repository.syncEnabled) {
      return emptyResult();
    }

    if (!repository.defaultBranch) {
      throw new Error("GITHUB_DEFAULT_BRANCH_UNKNOWN");
    }

    const [profile] = await this.db
      .select({
        githubLogin: appProfiles.githubLogin,
        githubUserId: appProfiles.githubUserId,
      })
      .from(appProfiles)
      .where(eq(appProfiles.userId, context.userId))
      .limit(1);

    if (!profile?.githubLogin || profile.githubUserId === null) {
      throw new Error("GITHUB_IDENTITY_INCOMPLETE");
    }

    const accessToken = await this.getAccessToken(context.userId);

    const cursor = await this.githubSyncCursorService.getCursor(context);
    const startedAt = new Date();

    const since = cursor?.lastSuccessAt
      ? new Date(cursor.lastSuccessAt.getTime() - OVERLAP_HOURS * 60 * 60_000)
      : new Date(startedAt.getTime() - INITIAL_HISTORY_DAYS * 24 * 60 * 60_000);

    const [owner, name, extra] = repository.fullName.split("/");

    if (!owner || !name || extra) {
      throw new Error("INVALID_GITHUB_REPOSITORY_NAME");
    }

    let commitsFetched = 0;
    let eventsUpsetter = 0;
    let commitsIgnored = 0;
    let pagesFetched = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = new URL(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits`,
      );

      url.searchParams.set("sha", repository.defaultBranch);
      url.searchParams.set("author", profile.githubLogin);
      url.searchParams.set("since", since.toISOString());
      url.searchParams.set("until", startedAt.toISOString());
      url.searchParams.set("per_page", String(PAGE_SIZE));
      url.searchParams.set("page", String(page));

      this.logger.info(
        {
          repositoryId,
          fullName: repository.fullName,
          defaultBranch: repository.defaultBranch,
          githubLogin: profile.githubLogin,
          lastSuccessAt: cursor?.lastSuccessAt?.toISOString() ?? null,
          since: since.toISOString(),
          until: startedAt.toISOString(),
          page,
        },
        "Fetching GitHub commits",
      );

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "developer-social-api",
        },
        signal: AbortSignal.timeout(20_000),
      });

      // Repositório Git ainda vazio.
      if (response.status === 409) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;

        if (body?.message?.toLowerCase().includes("git repository is empty")) {
          this.logger.info(
            {
              message: body?.message,
            },
            "Repository empty",
          );

          pagesFetched++;
          break;
        }

        throw new Error("GITHUB_REPOSITORY_CONFLICT");
      }

      if (!response.ok) {
        this.handleGithubError(response);
      }

      const payload: unknown = await response.json();

      if (!Array.isArray(payload)) {
        throw new Error("INVALID_GITHUB_RESPONSE");
      }

      const commits = payload as GithubCommit[];
      const hasNext =
        response.headers.get("link")?.includes('rel="next"') ?? false;

      this.logger.info(
        {
          repositoryId,
          httpStatus: response.status,
          commitsReceived: commits.length,
          hasNext,
          page,
        },
        "GitHub commits response",
      );

      pagesFetched++;
      commitsFetched += commits.length;

      // 6. Normalizar os commits para eventos.
      const events: Array<typeof githubActivityEvents.$inferInsert> = [];

      for (const commit of commits) {
        const authorId = commit.author?.id;
        const authorDate = commit.commit?.author?.date;

        if (
          typeof authorId !== "number" ||
          !Number.isSafeInteger(authorId) ||
          !authorDate ||
          !commit.sha
        ) {
          commitsIgnored++;
          continue;
        }

        // A identidade do autor precisa ser
        // a mesma da conta GitHub vinculada.
        const actorId = BigInt(authorId);

        if (actorId !== BigInt(profile.githubUserId)) {
          commitsIgnored++;
          continue;
        }

        const occurredAt = new Date(authorDate);

        if (
          !Number.isFinite(occurredAt.getTime()) ||
          occurredAt.getTime() > startedAt.getTime() + 5 * 60_000
        ) {
          commitsIgnored++;
          continue;
        }

        events.push({
          id: createId(),
          userId: context.userId,
          repositoryId,
          sourceType: "commit",
          externalKey: `${repository.githubRepoId}:${commit.sha}`,
          githubActorId: actorId,
          occurredAt,
          sourceVisibility: repository.visibility,
          isEligible: !repository.isFork,
          eligibilityVersion: ELIGIBILITY_VERSION,
          syncedAt: new Date(),
        });
      }

      // 7. Um upsert para a página inteira.
      // A chave composta já existe no schema.
      if (events.length > 0) {
        await this.db
          .insert(githubActivityEvents)
          .values(events)
          .onConflictDoUpdate({
            target: [
              githubActivityEvents.userId,
              githubActivityEvents.sourceType,
              githubActivityEvents.externalKey,
            ],
            set: {
              githubActorId: sql`excluded.github_actor_id`,
              occurredAt: sql`excluded.occurred_at`,
              sourceVisibility: sql`excluded.source_visibility`,
              isEligible: sql`excluded.is_eligible`,
              eligibilityVersion: sql`excluded.eligibility_version`,
              syncedAt: sql`excluded.synced_at`,
            },
          });

        eventsUpsetter += events.length;
      }

      if (!hasNext) {
        break;
      }

      // Não marcar sucesso se o histórico
      // não foi percorrido completamente.
      if (page === MAX_PAGES) {
        throw new Error("GITHUB_COMMITS_PAGE_LIMIT_EXCEEDED");
      }
    }

    return {
      repositoryId,
      commitsFetched,
      eventsUpsetter,
      commitsIgnored,
      pagesFetched,
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
