import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { Cron, CronExpression } from "@nestjs/schedule";
import { and, asc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { PinoLogger } from "nestjs-pino";

import {
  accounts,
  githubRepositories,
  githubSyncCursors,
  userRepositoryAccess,
} from "@/database/schema";

import { GithubSyncService } from "./github-sync.service";

const BATCH_SIZE = 100;
const INTERRUPTED_AFTER_MS = 60 * 60_000;

@Injectable()
export class GithubSyncSchedulerService {
  constructor(
    @InjectDrizzle()
    private readonly db: NodePgDatabase,
    private readonly githubSyncService: GithubSyncService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GithubSyncSchedulerService.name);
  }

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: "github-sync-due",
    waitForCompletion: true,
  })
  async enqueueDueSyncs(): Promise<void> {
    if (process.env.GITHUB_SYNC_SCHEDULER_ENABLED === "false") {
      return;
    }

    const now = new Date();
    const interruptedBefore = new Date(now.getTime() - INTERRUPTED_AFTER_MS);

    const cursors = await this.db
      .select({
        userId: githubSyncCursors.userId,
        resourceType: githubSyncCursors.resourceType,
        repositoryId: githubSyncCursors.repositoryId,
      })
      .from(githubSyncCursors)
      .innerJoin(
        accounts,
        and(
          eq(accounts.userId, githubSyncCursors.userId),
          eq(accounts.providerId, "github"),
        ),
      )
      .where(
        and(
          eq(githubSyncCursors.resourceType, "repositories"),
          isNull(githubSyncCursors.repositoryId),
          or(
            lte(githubSyncCursors.nextSyncAt, now),
            and(
              eq(githubSyncCursors.status, "idle"),
              isNull(githubSyncCursors.nextSyncAt),
            ),
            and(
              eq(githubSyncCursors.status, "running"),
              lt(githubSyncCursors.lastAttemptAt, interruptedBefore),
            ),
          ),
        ),
      )
      .orderBy(asc(githubSyncCursors.nextSyncAt), asc(githubSyncCursors.userId))
      .limit(BATCH_SIZE);

    let queued = 0;
    let failed = 0;

    for (const cursor of cursors) {
      try {
        const result = await this.githubSyncService.enqueue(
          {
            userId: cursor.userId,
            resourceType: cursor.resourceType,
            repositoryId: cursor.repositoryId,
          },
          "automatic",
        );

        if (result.status === "queued") {
          queued++;
        }
      } catch (error) {
        failed++;

        this.logger.error(
          {
            userId: cursor.userId,
            resourceType: cursor.resourceType,
            err: error,
          },
          "Failed to enqueue scheduled Github sync",
        );
      }
    }

    this.logger.info(
      { candidates: cursors.length, queued, failed },
      "Github sync scheduler sweep completed",
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: "github-commits-due",
    waitForCompletion: true,
  })
  async enqueueDueCommits(): Promise<void> {
    if (process.env.GITHUB_SYNC_SCHEDULER_ENABLED === "false") {
      return;
    }

    const now = new Date();

    const candidates = await this.db
      .select({
        userId: userRepositoryAccess.userId,
        repositoryId: userRepositoryAccess.repositoryId,
      })
      .from(userRepositoryAccess)
      .innerJoin(
        githubRepositories,
        eq(githubRepositories.id, userRepositoryAccess.repositoryId),
      )
      .innerJoin(
        accounts,
        and(
          eq(accounts.userId, userRepositoryAccess.userId),
          eq(accounts.providerId, "github"),
        ),
      )
      .leftJoin(
        githubSyncCursors,
        and(
          eq(githubSyncCursors.userId, userRepositoryAccess.userId),
          eq(githubSyncCursors.repositoryId, userRepositoryAccess.repositoryId),
          eq(githubSyncCursors.resourceType, "commits"),
        ),
      )
      .where(
        and(
          eq(userRepositoryAccess.syncEnabled, true),
          eq(githubRepositories.visibility, "public"),
          or(
            isNull(githubSyncCursors.id),
            and(
              inArray(githubSyncCursors.status, ["idle", "error"]),
              or(
                isNull(githubSyncCursors.nextSyncAt),
                lte(githubSyncCursors.nextSyncAt, now),
              ),
            ),
          ),
        ),
      )
      .orderBy(
        asc(userRepositoryAccess.userId),
        asc(userRepositoryAccess.repositoryId),
      )
      .limit(25);

    let queued = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        const result = await this.githubSyncService.enqueue(
          {
            userId: candidate.userId,
            resourceType: "commits",
            repositoryId: candidate.repositoryId,
          },
          "automatic",
        );

        if (result.status === "queued") {
          queued++;
        }
      } catch (error) {
        failed++;

        this.logger.error(
          {
            userId: candidate.userId,
            repositoryId: candidate.repositoryId,
            err: error,
          },
          "Failed to enqueue Github commits sync",
        );
      }

      this.logger.info(
        {
          candidates: candidates.length,
          queued,
          failed,
        },
        "Github commits scheduler sweep completed",
      );
    }
  }
}
