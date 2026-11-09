import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
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

  @Post("ensure")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Ensure Github data synchronization",
  })
  async ensureSync(@Session() session: UserSession) {
    return this.githubSyncService.enqueue(
      {
        userId: session.user.id,
        resourceType: "repositories",
        repositoryId: null,
      },
      "automatic",
    );
  }

  @Post("commits/:repositoryId")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Queue a GitHub commits sync (development)",
  })
  async syncCommits(
    @Session() session: UserSession,
    @Param("repositoryId") repositoryId: string,
  ) {
    if (process.env.NODE_ENV !== "development") {
      throw new ForbiddenException();
    }

    return this.githubSyncService.enqueue(
      {
        userId: session.user.id,
        resourceType: "commits",
        repositoryId,
      },
      "manual",
    );
  }
}
