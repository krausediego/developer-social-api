import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { GITHUB_JOBS, QUEUES } from "@/infrastructure/queues";

import { GithubSyncCursorService } from "./github-sync-cursor.service";
import { GithubSyncContext, GithubSyncTrigger } from "./types";

export interface GithubSyncServiceResponse {
  status: string;
  jobId?: string | null;
  retryAt?: string | null;
}

export type GithubSyncJobData = GithubSyncContext;

@Injectable()
export class GithubSyncService {
  constructor(
    @InjectQueue(QUEUES.GITHUB_SYNC)
    private readonly queue: Queue<GithubSyncJobData>,
    private readonly githubSyncCursorService: GithubSyncCursorService,
  ) {}

  async enqueue(
    context: GithubSyncContext,
    trigger: GithubSyncTrigger,
  ): Promise<GithubSyncServiceResponse> {
    const jobName = this.resolveJobName(context);
    const key = this.deduplicationId(context);

    const existingJobId = await this.queue.getDeduplicationJobId(key);

    if (existingJobId) {
      return {
        status: "already_queued" as const,
        jobId: existingJobId,
        retryAt: null,
      };
    }

    const decision = await this.githubSyncCursorService.canEnqueue(
      context,
      trigger,
    );

    if (!decision.allowed) {
      return {
        status:
          trigger === "manual" ? ("cooldown" as const) : ("not_due" as const),
        jobId: null,
        retryAt: decision.retryAt?.toISOString() ?? null,
      };
    }

    const job = await this.queue.add(jobName, context, {
      deduplication: {
        id: key,
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
    });

    const retainedJobId = await this.queue.getDeduplicationJobId(key);

    return {
      status:
        retainedJobId && retainedJobId !== job.id
          ? ("already_queued" as const)
          : ("queued" as const),
      jobId: retainedJobId ?? job.id,
      retryAt: null,
    };
  }

  async enqueueRepositoriesSync(
    userId: string,
  ): Promise<GithubSyncServiceResponse> {
    return this.enqueue(
      {
        userId,
        resourceType: "repositories",
        repositoryId: null,
      },
      "manual",
    );
  }

  async getSyncStatus(context: GithubSyncContext) {
    this.resolveJobName(context);

    const cursor = await this.githubSyncCursorService.getCursor(context);
    const key = this.deduplicationId(context);

    const jobId = await this.queue.getDeduplicationJobId(key);

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
      jobId: jobId ?? null,
      lastAttemptAt: cursor?.lastAttemptAt?.toISOString() ?? null,
      lastSuccessAt: cursor?.lastSuccessAt?.toISOString() ?? null,
      nextSyncAt: cursor?.nextSyncAt?.toISOString() ?? null,
      retryCount: cursor?.retryCount ?? 0,
      errorCode: cursor?.errorCode ?? null,
    };
  }

  async getRepositoriesSyncStatus(userId: string) {
    const result = await this.getSyncStatus({
      userId,
      resourceType: "repositories",
      repositoryId: null,
    });

    return {
      status: result.status,
      resources: {
        repositories: result,
      },
    };
  }

  private resolveJobName(context: GithubSyncContext): string {
    switch (context.resourceType) {
      case "repositories":
        if (context.repositoryId !== null) {
          throw new BadRequestException("INVALID_SYNC_CONTEXT");
        }
        return GITHUB_JOBS.SYNC_REPOSITORIES;

      case "commits":
        if (context.repositoryId === null) {
          throw new BadRequestException("REPOSITORY_ID_REQUIRED");
        }
        return GITHUB_JOBS.SYNC_COMMITS;

      case "pull_requests":
        if (context.repositoryId === null) {
          throw new BadRequestException("REPOSITORY_ID_REQUIRED");
        }
        return GITHUB_JOBS.SYNC_PULL_REQUESTS;

      default:
        throw new BadRequestException("UNSUPPORTED_SYNC_RESOURCE");
    }
  }

  private deduplicationId(context: GithubSyncContext): string {
    return [
      context.userId,
      context.resourceType,
      context.repositoryId ?? "all",
    ].join(":");
  }
}
