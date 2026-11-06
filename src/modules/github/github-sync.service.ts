import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { GITHUB_JOBS, QUEUES } from "@/infrastructure/queues";

export interface SyncRepositoriesJobData {
  userId: string;
}

export interface GithubSyncServiceResponse {
  jobId?: string;
}

@Injectable()
export class GithubSyncService {
  constructor(
    @InjectQueue(QUEUES.GITHUB_SYNC)
    private readonly queue: Queue<SyncRepositoriesJobData>,
  ) {}

  async enqueueRepositoriesSync(
    userId: string,
  ): Promise<GithubSyncServiceResponse> {
    const job = await this.queue.add(
      GITHUB_JOBS.SYNC_REPOSITORIES,
      { userId },
      {
        deduplication: {
          id: `repositories-${userId}`,
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

    return {
      jobId: job.id,
    };
  }
}
