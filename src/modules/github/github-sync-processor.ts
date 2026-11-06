import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { GITHUB_JOBS, QUEUES } from "@/infrastructure/queues";

import { GithubRepositoriesService } from "./github-repositories.service";
import { SyncRepositoriesJobData } from "./github-sync.service";

@Processor(QUEUES.GITHUB_SYNC, {
  concurrency: 1,
})
@Injectable()
export class GithubSyncProcessor extends WorkerHost {
  constructor(
    private readonly githubRepositoriesService: GithubRepositoriesService,
    private readonly logger: PinoLogger,
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

    this.logger.info(
      { jobId: job.id, userId },
      "Starting Github repository sync",
    );

    await this.githubRepositoriesService.sync(userId);

    this.logger.info(
      { jobId: job.id, userId },
      "Github repository sync completed",
    );
  }
}
