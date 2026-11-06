import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { GetPublicProfilesParamsDto, PublicProfileResponseDto } from "./dto";
import { ProfilesService } from "./profiles.service";

@ApiTags("Profiles")
@Controller("api/v1/profiles")
@UseGuards(ThrottlerGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(":githubLogin")
  @AllowAnonymous()
  @Throttle({
    default: {
      limit: 30,
      ttl: 60_000,
    },
  })
  async findPublicProfile(
    @Param() dto: GetPublicProfilesParamsDto,
  ): Promise<PublicProfileResponseDto> {
    return this.profilesService.getPublicProfile(dto.githubLogin);
  }
}
