import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
import { UserDailyActivitiesService } from "./user-daily-activities.service";

@ApiTags("Github")
@ApiCookieAuth()
@Controller("api/v1/github/sync")
export class GithubSyncController {
  constructor(
    private readonly githubSyncService: GithubSyncService,
    private readonly userDailyActivitiesService: UserDailyActivitiesService,
  ) {}

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

  @Post("me/activities/recalculate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Recalculate daily activities",
  })
  async recalculateActivities(@Session() session: UserSession) {
    if (process.env.NODE_ENV !== "development") {
      throw new NotFoundException();
    }

    return this.userDailyActivitiesService.recalculate(session.user.id);
  }
}
