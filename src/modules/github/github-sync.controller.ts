import { Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";

import { GithubSyncService } from "./github-sync.service";

@ApiTags("Github")
@ApiCookieAuth()
@Controller("api/v1/github/sync")
export class GithubSyncController {
  constructor(private readonly githubSyncService: GithubSyncService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Request Github repository synchronization",
  })
  @ApiAcceptedResponse({
    description: "Synchronization queued",
  })
  async requestSync(@Session() session: UserSession) {
    return this.githubSyncService.enqueueRepositoriesSync(session.user.id);
  }

  @Get("status")
  @ApiOperation({
    summary: "Get Github synchronization status",
  })
  async getStatus(@Session() session: UserSession) {
    return this.githubSyncService.getRepositoriesSyncStatus(session.user.id);
  }
}
