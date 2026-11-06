import { Body, Controller, Get, Patch } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";

import {
  UpdateProfileVisibilityDto,
  UpdateUserDto,
  UserResponseDto,
} from "./dto";
import { UsersService } from "./users.service";

@ApiTags("Users")
@ApiCookieAuth()
@Controller("api/v1/users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({
    summary: "Get authenticated user profile",
  })
  @ApiOkResponse({
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async findMe(@Session() session: UserSession): Promise<UserResponseDto> {
    return this.usersService.findMe(session.user.id);
  }

  @Patch("me")
  @ApiOperation({
    summary: "Update authenticated user profile",
  })
  @ApiOkResponse({
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async updateMe(
    @Session() session: UserSession,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateMe(session.user.id, dto);
  }

  @Patch("me/visibility")
  @ApiOperation({
    summary: "Change profile visibility",
  })
  @ApiOkResponse({
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async changeVisibility(
    @Session() session: UserSession,
    @Body() dto: UpdateProfileVisibilityDto,
  ): Promise<UserResponseDto> {
    return this.usersService.changeVisibility(session.user.id, dto);
  }
}
