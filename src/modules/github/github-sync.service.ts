import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { GITHUB_JOBS, QUEUES } from "@/infrastructure/queues";

import { GithubSyncCursorService } from "./github-sync-cursor.service";

export interface SyncRepositoriesJobData {
  userId: string;
}

export interface GithubSyncServiceResponse {
  status: string;
  jobId?: string | null;
  retryAt?: string | null;
}

@Injectable()
export class GithubSyncService {
  constructor(
    @InjectQueue(QUEUES.GITHUB_SYNC)
    private readonly queue: Queue<SyncRepositoriesJobData>,
    private readonly githubSyncCursorService: GithubSyncCursorService,
  ) {}

  async enqueueRepositoriesSync(
    userId: string,
    trigger: "manual" | "automatic" = "manual",
  ): Promise<GithubSyncServiceResponse> {
    const deduplicationId = `repositories:${userId}`;

    const existingJobId =
      await this.queue.getDeduplicationJobId(deduplicationId);

    if (existingJobId) {
      return {
        status: "already_queued" as const,
        jobId: existingJobId ?? null,
      };
    }

    const decision = await this.githubSyncCursorService.canEnqueue(
      userId,
      trigger,
    );

    if (!decision.allowed) {
      return {
        status:
          trigger === "manual"
            ? ("cooldown" as const)
            : ("up_to_date" as const),
        jobId: null,
        retryAt: decision.retryAt?.toISOString() ?? null,
      };
    }

    const job = await this.queue.add(
      GITHUB_JOBS.SYNC_REPOSITORIES,
      { userId },
      {
        deduplication: {
          id: deduplicationId,
        },
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5_000,
        },
        removeOnComplete: {
          age: 3_600,
          count: 1_000,
        },
        removeOnFail: {
          age: 86_400,
          count: 1_000,
        },
      },
    );

    const actualJobId = await this.queue.getDeduplicationJobId(deduplicationId);

    return {
      status: "queued" as const,
      jobId: actualJobId ?? job.id,
    };
  }

  async getRepositoriesSyncStatus(userId: string) {
    const cursor =
      await this.githubSyncCursorService.getRepositoriesCursor(userId);

    const jobId = await this.queue.getDeduplicationJobId(
      `repositories:${userId}`,
    );

    const now = new Date();

    let status:
      | "pending"
      | "queued"
      | "running"
      | "retrying"
      | "completed"
      | "stale"
      | "failed"
      | "interrupted";

    if (jobId) {
      const job = await this.queue.getJob(jobId);
      const jobState = job ? await job.getState() : null;

      if (jobState === "active") {
        status = "running";
      } else if (jobState === "delayed" && cursor?.status === "error") {
        status = "retrying";
      } else {
        status = "queued";
      }
    } else if (!cursor) {
      status = "pending";
    } else if (cursor.status === "error") {
      status = "failed";
    } else if (cursor.status === "running") {
      status = "interrupted";
    } else if (!cursor.lastSuccessAt) {
      status = "pending";
    } else if (cursor.nextSyncAt && cursor.nextSyncAt <= now) {
      status = "stale";
    } else {
      status = "completed";
    }

    return {
      status,
      resources: {
        repositories: {
          status,
          jobId: jobId ?? null,
          lastAttemptAt: cursor?.lastAttemptAt?.toISOString() ?? null,
          lastSuccessAt: cursor?.lastSuccessAt?.toISOString() ?? null,
          nextSyncAt: cursor?.nextSyncAt?.toISOString() ?? null,
          retryCount: cursor?.retryCount ?? 0,
          errorCode: cursor?.errorCode ?? null,
        },
      },
    };
  }
}
