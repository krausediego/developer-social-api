import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { and, eq, gt, sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { I18nContext, I18nService } from "nestjs-i18n";

import { appProfiles, userDailyActivities } from "@/database/schema";
import { calculateStreaks, getTodayInTimezone } from "@/helpers";

import { PublicProfileResponseDto } from "./dto";

@Injectable()
export class ProfilesService {
  constructor(
    @InjectDrizzle()
    private readonly db: NodePgDatabase,
    private readonly i18n: I18nService,
  ) {}

  async getPublicProfile(
    githubLogin: string,
  ): Promise<PublicProfileResponseDto> {
    const lang = I18nContext.current()?.lang ?? "pt-BR";

    const [profile] = await this.db
      .select({
        id: appProfiles.userId,
        displayName: appProfiles.displayName,
        bio: appProfiles.bio,
        publishedAt: appProfiles.publishedAt,
        login: appProfiles.githubLogin,
        name: appProfiles.githubName,
        avatarUrl: appProfiles.avatarUrl,
        timezone: appProfiles.timezone,
      })
      .from(appProfiles)
      .where(
        and(
          sql`lower(${appProfiles.githubLogin}) = lower(${githubLogin})`,
          eq(appProfiles.visibility, "public"),
        ),
      )
      .limit(1);

    if (!profile) {
      throw new NotFoundException({
        code: "PROFILE_NOT_FOUND",
        message: this.i18n.t("errors.PROFILE_NOT_FOUND", { lang }),
      });
    }

    const [stats] = await this.db
      .select({
        totalCommits: sql<number>`
          COALESCE(SUM(${userDailyActivities.commitsCount}), 0)::int
        `,
        totalPullRequests: sql<number>`
          COALESCE(SUM(${userDailyActivities.prsOpenedCount}), 0)::int
        `,
        totalIssues: sql<number>`
          COALESCE(SUM(${userDailyActivities.issuesOpenedCount}), 0)::int
        `,
        totalReviews: sql<number>`
          COALESCE(SUM(${userDailyActivities.reviewsCount}), 0)::int
        `,
      })
      .from(userDailyActivities)
      .where(
        and(
          eq(userDailyActivities.userId, profile.id),
          eq(userDailyActivities.timezone, profile.timezone),
        ),
      );

    const activeDays = await this.db
      .select({
        date: userDailyActivities.activityDate,
      })
      .from(userDailyActivities)
      .where(
        and(
          eq(userDailyActivities.userId, profile.id),
          eq(userDailyActivities.timezone, profile.timezone),
          gt(userDailyActivities.eligibleEventCount, 0),
        ),
      );

    const today = getTodayInTimezone(profile.timezone);

    const { currentStreak, longestStreak } = calculateStreaks(
      activeDays.map(({ date }) => date),
      today,
    );

    return {
      id: profile.id,
      profile: {
        displayName: profile.displayName,
        bio: profile.bio,
        publishedAt: profile.publishedAt?.toISOString() ?? null,
      },
      github: {
        login: profile.login,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
      stats: {
        currentStreak,
        longestStreak,
        totalCommits: stats.totalCommits,
        totalPullRequests: stats.totalPullRequests,
        totalIssues: stats.totalIssues,
        totalReviews: stats.totalReviews,
      },
    };
  }
}
