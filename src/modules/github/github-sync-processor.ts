import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { GITHUB_JOBS, QUEUES } from "@/infrastructure/queues";

import { GithubCommitsService } from "./github-commits.service";
import { GithubIssuesService } from "./github-issues.service";
import { GithubPullRequestsService } from "./github-pull-requests.service";
import { GithubRepositoriesService } from "./github-repositories.service";
import { GithubSyncJobData } from "./github-sync.service";
import { GithubSyncCursorService } from "./github-sync-cursor.service";
import { UserDailyActivitiesService } from "./user-daily-activities.service";

@Processor(QUEUES.GITHUB_SYNC, {
  concurrency: 1,
})
@Injectable()
export class GithubSyncProcessor extends WorkerHost {
  constructor(
    private readonly githubSyncCursorService: GithubSyncCursorService,
    private readonly githubRepositoriesService: GithubRepositoriesService,
    private readonly githubCommitsService: GithubCommitsService,
    private readonly userDailyActivitiesService: UserDailyActivitiesService,
    private readonly githubPullRequestsService: GithubPullRequestsService,
    private readonly githubIssuesService: GithubIssuesService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(GithubSyncProcessor.name);
  }

  async process(job: Job<GithubSyncJobData>) {
    const context = job.data;

    switch (job.name) {
      case GITHUB_JOBS.SYNC_REPOSITORIES:
        if (
          context.resourceType !== "repositories" ||
          context.repositoryId !== null
        ) {
          throw new Error("INVALID_SYNC_CONTEXT");
        }

        return this.executeSync(job, () =>
          this.githubRepositoriesService.sync(context.userId),
        );

      case GITHUB_JOBS.SYNC_COMMITS:
        if (
          context.resourceType !== "commits" ||
          context.repositoryId === null
        ) {
          throw new Error("INVALID_SYNC_CONTEXT");
        }

        return this.executeSync(
          job,
          async () => {
            const result = await this.githubCommitsService.sync(context);

            await this.userDailyActivitiesService.recalculate(context.userId);

            return result;
          },
          (result) => !result.hasMore,
        );

      case GITHUB_JOBS.SYNC_PULL_REQUESTS:
        if (
          context.resourceType !== "pull_requests" ||
          context.repositoryId === null
        ) {
          throw new Error("INVALID_SYNC_CONTEXT");
        }

        return this.executeSync(
          job,
          async () => {
            const result = await this.githubPullRequestsService.sync(context);

            await this.userDailyActivitiesService.recalculate(context.userId);

            return result;
          },
          (result) => !result.hasMore,
        );

      case GITHUB_JOBS.SYNC_ISSUES:
        if (
          context.resourceType !== "issues" ||
          context.repositoryId === null
        ) {
          throw new Error("INVALID_SYNC_CONTEXT");
        }
        return this.executeSync(
          job,
          async () => {
            const result = await this.githubIssuesService.sync(context);

            await this.userDailyActivitiesService.recalculate(context.userId);

            return result;
          },
          (result) => !result.hasMore,
        );

      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  private async executeSync<T>(
    job: Job<GithubSyncJobData>,
    handler: () => Promise<T>,
    isFinished: (result: T) => boolean = () => true,
  ): Promise<T> {
    const context = job.data;

    await this.githubSyncCursorService.markStarted(context, job.attemptsMade);

    try {
      this.logger.info({ jobId: job.id, ...context }, "GitHub sync started");

      const result = await handler();

      if (isFinished(result)) {
        await this.githubSyncCursorService.markSucceeded(context, {
          clearCursor: ["commits", "pull_requests", "issues"].includes(
            context.resourceType,
          ),
        });

        this.logger.info(
          { jobId: job.id, ...context, result },
          "GitHub sync completed",
        );
      } else {
        await this.githubSyncCursorService.scheduleContinuation(context);

        this.logger.info(
          { jobId: job.id, ...context, result },
          "Github sync batch completed; continuation scheduled",
        );
      }

      return result;
    } catch (error) {
      const errorCode = this.getErrorCode(error);

      try {
        await this.githubSyncCursorService.markFailed(
          context,
          errorCode,
          job.attemptsMade + 1,
        );
      } catch (cursorError) {
        this.logger.error(
          {
            jobId: job.id,
            error: cursorError,
          },
          "Failed to persist GitHub sync error state",
        );
      }

      // BullMQ precisa receber o erro para tentar novamente.
      throw error;
    }
  }

  private getErrorCode(error: unknown): string {
    const knownCodes = new Set([
      "GITHUB_RATE_LIMIT_EXCEEDED",
      "GITHUB_AUTH_INVALID",
      "GITHUB_ACCESS_TOKEN_UNAVAILABLE",
      "GITHUB_ACCOUNT_NOT_LINKED",
    ]);

    if (error instanceof Error && knownCodes.has(error.message)) {
      return error.message;
    }

    return "GITHUB_SYNC_FAILED";
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<GithubSyncJobData> | undefined, error: Error) {
    this.logger.error(
      {
        jobId: job?.id,
        jobName: job?.name,
        userId: job?.data.userId,
        resourceType: job?.data.resourceType,
        repositoryId: job?.data.repositoryId,
        attemptsMade: job?.attemptsMade,
        maxAttempts: job?.opts.attempts,
        err: error,
      },
      "GitHub sync job failed",
    );
  }
}
