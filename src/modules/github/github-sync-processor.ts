import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { GITHUB_JOBS, QUEUES } from "@/infrastructure/queues";

import { GithubRepositoriesService } from "./github-repositories.service";
import { SyncRepositoriesJobData } from "./github-sync.service";
import { GithubSyncCursorService } from "./github-sync-cursor.service";

@Processor(QUEUES.GITHUB_SYNC, {
  concurrency: 1,
})
@Injectable()
export class GithubSyncProcessor extends WorkerHost {
  constructor(
    private readonly githubRepositoriesService: GithubRepositoriesService,
    private readonly logger: PinoLogger,
    private readonly githubSyncCursorService: GithubSyncCursorService,
  ) {
    super();
    this.logger.setContext(GithubSyncProcessor.name);
  }

  async process(job: Job<SyncRepositoriesJobData>): Promise<void> {
    switch (job.name) {
      case GITHUB_JOBS.SYNC_REPOSITORIES:
        await this.syncRepositories(job);
        return;

      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  private async syncRepositories(
    job: Job<SyncRepositoriesJobData>,
  ): Promise<void> {
    const { userId } = job.data;

    await this.githubSyncCursorService.markStarted(userId, job.attemptsMade);

    try {
      this.logger.info(
        { jobId: job.id, userId },
        "Starting Github repository sync",
      );

      const result = await this.githubRepositoriesService.sync(userId);

      await this.githubSyncCursorService.markSucceeded(userId);

      this.logger.info(
        { jobId: job.id, userId, ...result },
        "Github repository sync completed",
      );
    } catch (error) {
      const code = this.getErrorCode(error);

      await this.githubSyncCursorService.markFailed(
        userId,
        code,
        job.attemptsMade + 1,
      );

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
}
