/* eslint-disable eqeqeq */
import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { PinoLogger } from "nestjs-pino";

import {
  accounts,
  appProfiles,
  githubActivityEvents,
  githubPullRequests,
  githubRepositories,
  githubReviews,
  userRepositoryAccess,
} from "@/database/schema";
import { parseReviewCheckpoint, ReviewsCheckpoint } from "@/helpers";
import { auth } from "@/modules/auth";

import { GithubSyncCursorService } from "./github-sync-cursor.service";
import { GithubSyncContext } from "./types";

export interface GithubReviewsSyncResult {
  repositoryId: string;
  mode: "backfill" | "incremental";
  pullRequestsFound: number;
  pullRequestsProcessed: number;
  reviewsFetched: number;
  reviewsUpserted: number;
  eventsUpserted: number;
  requestsMade: number;
  hasMore: boolean;
  completedAt: Date;
}

interface SyncProgress {
  searchPage: number;
  itemIndex: number;
  reviewPage: number;
}

interface GithubPullRequestResponse {
  id: number;
  number: number;
  state: "open" | "closed";
  user: {
    id: number;
  } | null;
  created_at: string;
  closed_at: string | null;
  merged_at: string | null;
}

interface GithubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: {
    number: number;
    pull_request?: {
      url: string;
    };
  }[];
}

interface GithubReviewResponse {
  id: number;
  user: {
    id: number;
  } | null;
  state: string;
  submitted_at: string | null;
}

const GITHUB_API = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";

const PAGE_SIZE = 100;
const MAX_HTTP_REQUESTS_PER_RUN = 20;
const MAX_SEARCH_PAGES = 10;

const HISTORY_DAYS = 365;
const OVERLAP_HOURS = 48;
const ELIGIBILITY_VERSION = 1;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const SUBMITTED_STATES = new Set([
  "APPROVED",
  "CHANGES_REQUESTED",
  "COMMENTED",
  "DISMISSED",
]);

@Injectable()
export class GithubReviewsService {
  constructor(
    @InjectDrizzle()
    private readonly db: NodePgDatabase,
    private readonly githubSyncCursorService: GithubSyncCursorService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GithubReviewsService.name);
  }

  async sync(context: GithubSyncContext): Promise<GithubReviewsSyncResult> {
    if (context.resourceType !== "reviews" || context.repositoryId === null) {
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
        eq(githubRepositories.id, userRepositoryAccess.repositoryId),
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

    if (!repository.syncEnabled) {
      throw new Error("GITHUB_REPOSITORY_SYNC_DISABLED");
    }

    if (repository.visibility !== "public") {
      throw new Error("GITHUB_PRIVATE_REPOSITORY_UNSUPPORTED");
    }

    if (repository.isFork) {
      throw new Error("GITHUB_FORK_REPOSITORY_UNSUPPORTED");
    }

    const [profile] = await this.db
      .select({
        githubLogin: appProfiles.githubLogin,
        githubUserId: appProfiles.githubUserId,
      })
      .from(appProfiles)
      .where(eq(appProfiles.userId, context.userId))
      .limit(1);

    if (!profile?.githubLogin || profile.githubUserId == null) {
      throw new Error("GITHUB_IDENTITY_INCOMPLETE");
    }

    const expectedReviewerId = BigInt(profile.githubUserId);

    const token = await this.getAccessToken(context.userId);

    const cursor = await this.githubSyncCursorService.getCursor(context);
    const checkpoint = parseReviewCheckpoint(cursor?.cursor ?? null);

    const now = new Date();

    const mode =
      checkpoint?.mode ?? (cursor?.lastSuccessAt ? "incremental" : "backfill");

    const lastSuccessAt = cursor?.lastSuccessAt
      ? new Date(cursor.lastSuccessAt)
      : null;

    if (lastSuccessAt && !Number.isFinite(lastSuccessAt.getTime())) {
      throw new Error("INVALID_REVIEWS_CURSOR_LAST_SUCCESS_AT");
    }

    const since = checkpoint
      ? new Date(checkpoint.since)
      : mode === "backfill"
        ? new Date(now.getTime() - HISTORY_DAYS * DAY_MS)
        : new Date(lastSuccessAt!.getTime() - OVERLAP_HOURS * HOUR_MS);

    const until = checkpoint ? new Date(checkpoint.until) : now;

    const [owner, repo, extra] = repository.fullName.split("/");

    if (!owner || !repo || extra) {
      throw new Error("INVALID_GITHUB_REPOSITORY_NAME");
    }

    const result: GithubReviewsSyncResult = {
      repositoryId,
      mode,
      pullRequestsFound: 0,
      pullRequestsProcessed: 0,
      reviewsFetched: 0,
      reviewsUpserted: 0,
      eventsUpserted: 0,
      requestsMade: 0,
      hasMore: false,
      completedAt: now,
    };

    let progress: SyncProgress = {
      searchPage: checkpoint?.searchPage ?? 1,
      itemIndex: checkpoint?.itemIndex ?? 0,
      reviewPage: checkpoint?.reviewPage ?? 1,
    };

    const saveProgress = async (next: SyncProgress): Promise<void> => {
      progress = next;

      await this.githubSyncCursorService.saveCheckpoint(
        context,
        JSON.stringify({
          version: 1,
          kind: "reviews",
          mode,
          since: since.toISOString(),
          until: until.toISOString(),
          ...next,
        } satisfies ReviewsCheckpoint),
      );
    };

    const returnPartial = (): GithubReviewsSyncResult => ({
      ...result,
      hasMore: true,
      completedAt: new Date(),
    });

    const returnComplete = (): GithubReviewsSyncResult => ({
      ...result,
      hasMore: false,
      completedAt: new Date(),
    });

    const request = async <T>(
      url: URL,
    ): Promise<{
      data: T;
      hasNext: boolean;
    }> => {
      if (result.requestsMade >= MAX_HTTP_REQUESTS_PER_RUN) {
        throw new Error("GITHUB_REVIEWS_REQUEST_BUDGET_EXCEEDED");
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
          "User-Agent": "developer-social-api",
        },
        signal: AbortSignal.timeout(20_000),
      });

      result.requestsMade++;

      if (!response.ok) {
        this.handleGithubError(response);
      }

      return {
        data: (await response.json()) as T,
        hasNext: response.headers.get("link")?.includes('rel="next"') ?? false,
      };
    };

    while (progress.searchPage <= MAX_SEARCH_PAGES) {
      if (result.requestsMade >= MAX_HTTP_REQUESTS_PER_RUN) {
        return returnPartial();
      }

      const searchUrl = new URL(`${GITHUB_API}/search/issues`);

      const sinceDay = since.toISOString().slice(0, 10);

      const untilDay = until.toISOString().slice(0, 10);

      const query = [
        "is:pr",
        `repo:${repository.fullName}`,
        `reviewed-by:${profile.githubLogin}`,
        `updated:${sinceDay}..${untilDay}`,
      ].join(" ");

      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("sort", "updated");
      searchUrl.searchParams.set("order", "desc");
      searchUrl.searchParams.set("per_page", String(PAGE_SIZE));
      searchUrl.searchParams.set("page", String(progress.searchPage));

      const search = await request<GithubSearchResponse>(searchUrl);

      if (
        !Array.isArray(search.data.items) ||
        !Number.isSafeInteger(search.data.total_count)
      ) {
        throw new Error("INVALID_GITHUB_SEARCH_RESPONSE");
      }

      if (search.data.incomplete_results || search.data.total_count > 1000) {
        throw new Error("GITHUB_REVIEWS_SEARCH_INCOMPLETE");
      }

      result.pullRequestsFound = Math.max(
        result.pullRequestsFound,
        search.data.total_count,
      );

      for (
        let index = progress.itemIndex;
        index < search.data.items.length;
        index++
      ) {
        // Reserva uma requisição para
        // detalhes e outra para reviews.
        if (result.requestsMade + 2 > MAX_HTTP_REQUESTS_PER_RUN) {
          return returnPartial();
        }

        const item = search.data.items[index];

        if (
          !Number.isSafeInteger(item.number) ||
          item.number <= 0 ||
          !item.pull_request
        ) {
          throw new Error("INVALID_GITHUB_SEARCH_ITEM");
        }

        // 6. Buscar detalhes da PR.
        //
        // O ID de Search Issues não é
        // o ID da entidade Pull Request.
        const pullUrl = new URL(
          `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${item.number}`,
        );

        const { data: pull } =
          await request<GithubPullRequestResponse>(pullUrl);

        if (
          pull.number !== item.number ||
          !pull.user ||
          !["open", "closed"].includes(pull.state)
        ) {
          throw new Error("INVALID_GITHUB_PULL_REQUEST");
        }

        const pullGithubId = BigInt(pull.id);
        const pullAuthorId = BigInt(pull.user.id);
        const pullCreatedAt = this.parseGithubDate(
          pull.created_at,
          "pull.created_at",
        );

        if (!pullCreatedAt) {
          throw new Error("INVALID_GITHUB_PULL_REQUEST_DATE");
        }

        let reviewPage = index === progress.itemIndex ? progress.reviewPage : 1;

        while (true) {
          if (result.requestsMade >= MAX_HTTP_REQUESTS_PER_RUN) {
            return returnPartial();
          }

          const reviewsUrl = new URL(
            `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${item.number}/reviews`,
          );

          reviewsUrl.searchParams.set("per_page", String(PAGE_SIZE));
          reviewsUrl.searchParams.set("page", String(reviewPage));

          const reviewsResponse =
            await request<GithubReviewResponse[]>(reviewsUrl);

          if (!Array.isArray(reviewsResponse.data)) {
            throw new Error("INVALID_GITHUB_REVIEWS_RESPONSE");
          }

          result.reviewsFetched += reviewsResponse.data.length;

          // 8. PR + reviews + eventos
          // persistidos atomicamente.
          const persisted = await this.db.transaction(async (tx) => {
            const syncedAt = new Date();

            const pullData = {
              githubPrId: pullGithubId,
              repositoryId,
              number: pull.number,
              authorGithubId: pullAuthorId,
              state: pull.state,
              createdAt: pullCreatedAt,
              closedAt: this.parseGithubDate(pull.closed_at, "pull.closed_at"),
              mergedAt: this.parseGithubDate(pull.merged_at, "pull.merged_at"),
              syncedAt,
            };

            for (const [field, value] of Object.entries(pullData)) {
              if (value instanceof Date && !Number.isFinite(value.getTime())) {
                throw new Error(`INVALID_DATE_BEFORE_UPSERT: ${field}`);
              }
            }

            await tx
              .insert(githubPullRequests)
              .values({
                id: createId(),
                ...pullData,
              })
              .onConflictDoUpdate({
                target: githubPullRequests.githubPrId,
                set: pullData,
              });

            const [storedPull] = await tx
              .select({
                id: githubPullRequests.id,
              })
              .from(githubPullRequests)
              .where(eq(githubPullRequests.githubPrId, pullGithubId))
              .limit(1);

            if (!storedPull) {
              throw new Error("GITHUB_PULL_REQUEST_UPSERT_FAILED");
            }

            let upserted = 0;

            for (const review of reviewsResponse.data) {
              if (!review.user) continue;

              const reviewerId = BigInt(review.user.id);

              if (
                reviewerId !== expectedReviewerId ||
                !review.submitted_at ||
                !SUBMITTED_STATES.has(review.state)
              ) {
                continue;
              }

              const submittedAt = this.parseGithubDate(
                review.submitted_at,
                "review.submitted_at",
              );

              if (!submittedAt || submittedAt < since || submittedAt > until) {
                continue;
              }

              const reviewId = BigInt(review.id);

              const reviewData = {
                pullRequestId: storedPull.id,
                reviewerGithubId: reviewerId,
                state: review.state,
                submittedAt,
                syncedAt,
              };

              await tx
                .insert(githubReviews)
                .values({
                  id: createId(),
                  githubReviewId: reviewId,
                  ...reviewData,
                })
                .onConflictDoUpdate({
                  target: githubReviews.githubReviewId,
                  set: reviewData,
                });

              await tx
                .insert(githubActivityEvents)
                .values({
                  id: createId(),
                  userId: context.userId,
                  repositoryId,
                  sourceType: "pull_request_review_submitted",
                  externalKey: String(review.id),
                  githubActorId: reviewerId,
                  occurredAt: submittedAt,
                  sourceVisibility: "public",
                  isEligible: true,
                  eligibilityVersion: ELIGIBILITY_VERSION,
                  syncedAt,
                })
                .onConflictDoUpdate({
                  target: [
                    githubActivityEvents.userId,
                    githubActivityEvents.sourceType,
                    githubActivityEvents.externalKey,
                  ],
                  set: {
                    repositoryId,
                    occurredAt: submittedAt,
                    sourceVisibility: "public",
                    isEligible: true,
                    eligibilityVersion: ELIGIBILITY_VERSION,
                    syncedAt,
                  },
                });

              upserted++;
            }

            return upserted;
          });

          result.reviewsUpserted += persisted;
          result.eventsUpserted += persisted;

          if (reviewsResponse.hasNext) {
            reviewPage++;

            await saveProgress({
              searchPage: progress.searchPage,
              itemIndex: index,
              reviewPage,
            });
          } else {
            await saveProgress({
              searchPage: progress.searchPage,
              itemIndex: index + 1,
              reviewPage: 1,
            });

            result.pullRequestsProcessed++;
            break;
          }
        }
      }

      if (!search.hasNext) {
        this.logger.info(
          {
            userId: context.userId,
            repositoryId,
            mode,
            reviewsUpserted: result.reviewsUpserted,
            requestsMade: result.requestsMade,
          },
          "GitHub reviews sync completed",
        );

        return returnComplete();
      }

      await saveProgress({
        searchPage: progress.searchPage + 1,
        itemIndex: 0,
        reviewPage: 1,
      });
    }

    throw new Error("GITHUB_REVIEWS_SEARCH_PAGE_LIMIT_EXCEEDED");
  }

  private async getAccessToken(userId: string): Promise<string> {
    const [account] = await this.db
      .select({
        id: accounts.id,
      })
      .from(accounts)
      .where(
        and(eq(accounts.userId, userId), eq(accounts.providerId, "github")),
      )
      .limit(1);

    if (!account) {
      throw new Error("GITHUB_ACCOUNT_NOT_LINKED");
    }

    const token = await auth.api.getAccessToken({
      body: {
        accountId: account.id,
        userId,
      },
    });

    if (!token.accessToken) {
      throw new Error("GITHUB_ACCESS_TOKEN_UNAVAILABLE");
    }

    return token.accessToken;
  }

  private parseGithubDate(value: string | null, field: string): Date | null {
    if (value === null) {
      return null;
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      throw new Error(`INVALID_GITHUB_DATE: ${field}=${value}`);
    }

    return date;
  }

  private handleGithubError(response: Response): never {
    const remaining = response.headers.get("x-ratelimit-remaining");

    if (
      response.status === 429 ||
      (response.status === 403 && remaining === "0")
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
