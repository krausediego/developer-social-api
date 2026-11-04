import { Controller, Get, Patch, Session } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { UserResponseDto } from "./dto";
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
  async updateMe(): Promise<UserResponseDto> {}
}
