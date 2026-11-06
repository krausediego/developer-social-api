import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { QUEUES } from "@/infrastructure/queues";

import { GithubRepositoriesService } from "./github-repositories.service";
import { GithubSyncController } from "./github-sync.controller";
import { GithubSyncService } from "./github-sync.service";
import { GithubSyncProcessor } from "./github-sync-processor";

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
  ],
})
export class GithubModule {}
