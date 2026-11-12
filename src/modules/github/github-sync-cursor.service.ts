import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { and, eq, isNull } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

import { githubSyncCursors } from "@/database/schema";

import { GithubSyncContext } from "./types";

const MANUAL_COOLDOWN_MS = 5 * 60 * 1000;

type SyncTrigger = "manual" | "automatic";

const SYNC_INTERVAL_MS = {
  repositories: 30 * 60_000,
  commits: 6 * 60 * 60_000,
  pull_requests: 6 * 60 * 60_000,
} as const;

type CanEnqueueResponse = {
  allowed: boolean;
  retryAt: Date | null;
};

@Injectable()
export class GithubSyncCursorService {
  constructor(
    @InjectDrizzle()
    private readonly db: NodePgDatabase,
  ) {}

  async getCursor(context: GithubSyncContext) {
    const [cursor] = await this.db
      .select()
      .from(githubSyncCursors)
      .where(this.scopeWhere(context))
      .limit(1);

    return cursor ?? null;
  }

  async canEnqueue(
    context: GithubSyncContext,
    trigger: SyncTrigger,
  ): Promise<CanEnqueueResponse> {
    const cursor = await this.getCursor(context);
    const now = Date.now();

    if (!cursor) {
      return { allowed: true, retryAt: null };
    }

    if (trigger === "manual") {
      const retryAt = cursor.lastAttemptAt
        ? new Date(cursor.lastAttemptAt.getTime() + MANUAL_COOLDOWN_MS)
        : null;

      return {
        allowed: !retryAt || retryAt.getTime() <= now,
        retryAt,
      };
    }

    return {
      allowed: !cursor.nextSyncAt || cursor.nextSyncAt.getTime() <= now,
      retryAt: cursor.nextSyncAt,
    };
  }

  async markStarted(
    context: GithubSyncContext,
    attemptsMade: number,
  ): Promise<void> {
    const now = new Date();

    await this.db
      .insert(githubSyncCursors)
      .values({
        userId: context.userId,
        resourceType: context.resourceType,
        repositoryId: context.repositoryId,
        status: "running",
        lastAttemptAt: now,
        nextSyncAt: null,
        retryCount: attemptsMade,
        errorCode: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          githubSyncCursors.userId,
          githubSyncCursors.repositoryId,
          githubSyncCursors.resourceType,
        ],
        set: {
          status: "running",
          lastAttemptAt: now,
          nextSyncAt: null,
          retryCount: attemptsMade,
          errorCode: null,
          updatedAt: now,
        },
      });
  }

  async markSucceeded(
    context: GithubSyncContext,
    options: { clearCursor?: boolean } = {},
  ): Promise<Date> {
    const now = new Date();

    const [updated] = await this.db
      .update(githubSyncCursors)
      .set({
        status: "idle",
        lastSuccessAt: now,
        nextSyncAt: new Date(
          now.getTime() +
            SYNC_INTERVAL_MS[
              context.resourceType as keyof typeof SYNC_INTERVAL_MS
            ],
        ),
        retryCount: 0,
        errorCode: null,
        ...(options.clearCursor ? { cursor: null } : {}),
      })
      .where(this.scopeWhere(context))
      .returning({ id: githubSyncCursors.id });

    if (!updated) {
      throw new Error("SYNC_CURSOR_NOT_FOUND");
    }

    return now;
  }

  async markFailed(
    context: GithubSyncContext,
    errorCode: string,
    retryCount: number,
  ): Promise<void> {
    const now = new Date();

    await this.db
      .update(githubSyncCursors)
      .set({
        status: "error",
        errorCode,
        retryCount,
        nextSyncAt: new Date(now.getTime() + MANUAL_COOLDOWN_MS),
        updatedAt: now,
      })
      .where(this.scopeWhere(context));
  }

  async saveCheckpoint(context: GithubSyncContext, checkpoint: string) {
    const [updated] = await this.db
      .update(githubSyncCursors)
      .set({
        cursor: checkpoint,
      })
      .where(this.scopeWhere(context))
      .returning({ id: githubSyncCursors.id });

    if (!updated) {
      throw new Error("SYNC_CURSOR_NOT_FOUND");
    }
  }

  async scheduleContinuation(context: GithubSyncContext, delayMs = 60_000) {
    const now = new Date();

    const [updated] = await this.db
      .update(githubSyncCursors)
      .set({
        status: "idle",
        nextSyncAt: new Date(now.getTime() + delayMs),
        errorCode: null,
      })
      .where(this.scopeWhere(context))
      .returning({ id: githubSyncCursors.id });

    if (!updated) {
      throw new Error("SYNC_CURSOR_NOT_FOUND");
    }
  }

  private scopeWhere(context: GithubSyncContext) {
    return and(
      eq(githubSyncCursors.userId, context.userId),
      eq(githubSyncCursors.resourceType, context.resourceType),
      context.repositoryId === null
        ? isNull(githubSyncCursors.repositoryId)
        : eq(githubSyncCursors.repositoryId, context.repositoryId),
    );
  }
}
