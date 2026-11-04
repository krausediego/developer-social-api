import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { I18nContext, I18nService } from "nestjs-i18n";

import { appProfiles, users } from "@/database/schema";

import { UserResponseDto } from "./dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectDrizzle()
    private readonly db: NodePgDatabase,
    private readonly i18n: I18nService,
  ) {}

  async findMe(userId: string): Promise<UserResponseDto> {
    const [result] = await this.db
      .select({
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
        profile: {
          githubUserId: appProfiles.githubUserId,
          githubLogin: appProfiles.githubLogin,
          githubName: appProfiles.githubName,
          avatarUrl: appProfiles.avatarUrl,
          displayName: appProfiles.displayName,
          bio: appProfiles.bio,
          visibility: appProfiles.visibility,
          locale: appProfiles.locale,
          timezone: appProfiles.timezone,
          publishedAt: appProfiles.publishedAt,
        },
      })
      .from(users)
      .leftJoin(appProfiles, eq(users.id, appProfiles.userId))
      .where(eq(users.id, userId))
      .limit(1);

    if (!result) {
      throw this.profileNotFound();
    }

    if (!result.profile) {
      throw this.profileNotFound();
    }

    const { user, profile } = result;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      github: {
        id: profile.githubUserId?.toString() ?? null,
        login: profile.githubLogin,
        name: profile.githubName,
        avatarUrl: profile.avatarUrl,
      },
      profile: {
        displayName: profile.displayName,
        bio: profile.bio,
        visibility: profile.visibility as "private" | "public",
        locale: profile.locale,
        timezone: profile.timezone,
        publishedAt: profile.publishedAt?.toISOString() ?? null,
      },
    };
  }

  async updateMe(userId: string): Promise<UserResponseDto> {}

  private profileNotFound(): NotFoundException {
    const lang = I18nContext.current()?.lang ?? "pt-BR";

    return new NotFoundException({
      code: "PROFILE_NOT_FOUND",
      message: this.i18n.t("errors.PROFILE_NOT_FOUND", { lang }),
    });
  }
}
