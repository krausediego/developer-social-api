import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { QUEUES } from "@/infrastructure/queues";

import { GithubCommitsService } from "./github-commits.service";
import { GithubRepositoriesService } from "./github-repositories.service";
import { GithubSyncController } from "./github-sync.controller";
import { GithubSyncService } from "./github-sync.service";
import { GithubSyncCursorService } from "./github-sync-cursor.service";
import { GithubSyncProcessor } from "./github-sync-processor";
import { GithubSyncSchedulerService } from "./github-sync-scheduler.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUES.GITHUB_SYNC,
    }),
  ],
  controllers: [GithubSyncController],
  providers: [
    GithubSyncProcessor,
    GithubSyncService,
    GithubRepositoriesService,
    GithubCommitsService,
    GithubSyncCursorService,
    GithubSyncSchedulerService,
  ],
})
export class GithubModule {}
