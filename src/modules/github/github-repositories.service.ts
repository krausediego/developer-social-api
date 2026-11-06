import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { and, eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  accounts,
  githubRepositories,
  userRepositoryAccess,
} from "@/database/schema";
import { auth } from "@/modules/auth";

interface GithubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  default_branch: string | null;
  pushed_at: string | null;
  updated_at: string | null;
  owner: {
    id: number;
    type: string;
  };
}

export interface RepositoriesSyncResult {
  repositoriesProcessed: number;
  pagesFetched: number;
  completedAt: Date;
}

function toGithubId(id: number): bigint {
  if (!Number.isSafeInteger(id) || id < 0) {
    throw new Error("INVALID_GITHUB_ID");
  }

  return BigInt(id);
}

function parseGithubDate(value: string | null) {
  return value ? new Date(value) : null;
}

@Injectable()
export class GithubRepositoriesService {
  constructor(
    @InjectDrizzle()
    private readonly db: NodePgDatabase,
  ) {}

  async sync(userId: string): Promise<RepositoriesSyncResult> {
    const [account] = await this.db
      .select({
        id: accounts.id,
        accountId: accounts.accountId,
      })
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

    const githubUserId = BigInt(account.accountId);

    let repositoriesProcessed = 0;
    let pagesFetched = 0;

    for (let page = 1; ; page++) {
      const url = new URL("https://api.github.com/user/repos");

      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      url.searchParams.set("visibility", "all");
      url.searchParams.set(
        "affiliation",
        "owner,collaborator,organization_member",
      );

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "developer-social-api",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        if (
          response.status === 429 ||
          (response.status === 403 &&
            response.headers.get("x-rate-limit-remaining") === "0")
        ) {
          throw new Error("GITHUB_RATE_LIMIT_EXCEEDED");
        }

        if (response.status === 401) {
          throw new Error("GITHUB_AUTH_INVALID");
        }

        throw new Error(`GITHUB_API_ERROR_${response.status}`);
      }

      const repositories = (await response.json()) as GithubRepository[];

      if (!Array.isArray(repositories)) {
        throw new Error("INVALID_GITHUB_RESPONSE");
      }

      pagesFetched++;

      await this.db.transaction(async (tx) => {
        for (const repo of repositories) {
          const now = new Date();

          const repositoryData = {
            githubRepoId: toGithubId(repo.id),
            ownerGithubId: toGithubId(repo.owner.id),
            name: repo.name,
            fullName: repo.full_name,
            visibility: repo.private
              ? ("private" as const)
              : ("public" as const),
            defaultBranch: repo.default_branch,
            isFork: repo.fork,
            isArchived: repo.archived,
            pushedAt: parseGithubDate(repo.pushed_at),
            githubUpdatedAt: parseGithubDate(repo.updated_at),
            lastSyncedAt: now,
          };

          const [storedRepository] = await tx
            .insert(githubRepositories)
            .values(repositoryData)
            .onConflictDoUpdate({
              target: githubRepositories.githubRepoId,
              set: repositoryData,
            })
            .returning({
              id: githubRepositories.id,
            });

          const accessType =
            BigInt(repo.owner.id) === githubUserId
              ? "owner"
              : repo.owner.type === "Organization"
                ? "organization"
                : "collaborator";

          await tx
            .insert(userRepositoryAccess)
            .values({
              userId,
              repositoryId: storedRepository.id,
              accessType,
              syncEnabled: true,
              lastSeenAt: now,
            })
            .onConflictDoUpdate({
              target: [
                userRepositoryAccess.userId,
                userRepositoryAccess.repositoryId,
              ],
              set: {
                accessType,
                lastSeenAt: now,
              },
            });
        }
      });

      repositoriesProcessed += repositories.length;

      if (repositories.length < 100) {
        break;
      }
    }

    return {
      repositoriesProcessed,
      pagesFetched,
      completedAt: new Date(),
    };
  }
}
