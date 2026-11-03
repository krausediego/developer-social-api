import { Injectable, Logger } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { AfterCreate, DatabaseHook } from "@thallesp/nestjs-better-auth";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

import { appProfiles } from "@/database/schema";

type CreatedAccount = {
  userId: string;
  providerId: string;
  accountId: string;
};

type GithubProfile = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
};

@DatabaseHook()
@Injectable()
export class CreateProfileHook {
  private readonly logger = new Logger(CreateProfileHook.name);

  constructor(
    @InjectDrizzle()
    private readonly db: NodePgDatabase,
  ) {}

  @AfterCreate("user")
  async handle(user: { id: string }) {
    await this.db
      .insert(appProfiles)
      .values({
        userId: user.id,
        visibility: "private",
        locale: "pt-BR",
        timezone: "UTC",
      })
      .onConflictDoNothing();
  }

  @AfterCreate("account")
  async onAccountCreated(account: CreatedAccount) {
    if (account.providerId !== "github") {
      return;
    }

    try {
      const response = await fetch(
        `https://api.github.com/user/${encodeURIComponent(account.accountId)}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "developer-social-api",
          },
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        throw new Error(`Github API returned ${response.status}`);
      }

      const github = (await response.json()) as GithubProfile;

      if (BigInt(github.id) !== BigInt(account.accountId)) {
        throw new Error("Github account identity mismatch");
      }

      await this.db
        .insert(appProfiles)
        .values({
          userId: account.userId,
          githubUserId: BigInt(github.id),
          githubLogin: github.login,
          githubName: github.name,
          avatarUrl: github.avatar_url,
          bio: github.bio,
          visibility: "private",
          locale: "pt-BR",
          timezone: "UTC",
        })
        .onConflictDoUpdate({
          target: appProfiles.userId,
          set: {
            githubUserId: BigInt(github.id),
            githubLogin: github.login,
            githubName: github.name,
            avatarUrl: github.avatar_url,
            bio: github.bio,
          },
        });
    } catch (error) {
      this.logger.warn(
        `Failed to sync github profile for user ${account.userId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
