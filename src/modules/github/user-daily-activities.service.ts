import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { and, eq, sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  appProfiles,
  githubActivityEvents,
  userDailyActivities,
} from "@/database/schema";

export interface DailyActivitiesResult {
  userId: string;
  timezone: string;
  daysRecalculated: number;
  eligibleEvents: number;
  completedAt: Date;
}

@Injectable()
export class UserDailyActivitiesService {
  constructor(
    @InjectDrizzle()
    private readonly db: NodePgDatabase,
  ) {}

  async recalculate(userId: string): Promise<DailyActivitiesResult> {
    return this.db.transaction(async (tx) => {
      // Prevent two recalculations for same user
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${userId}, 0)
        )
      `);

      const [profile] = await tx
        .select({
          timezone: appProfiles.timezone,
        })
        .from(appProfiles)
        .where(eq(appProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        throw new Error("USER_PROFILE_NOT_FOUND");
      }

      const timezone = profile.timezone;

      const localDate = sql<string>`
        (
          ${githubActivityEvents.occurredAt}
          AT TIME ZONE ${sql.raw(`'${timezone.replaceAll("'", "''")}'`)}
        )::date
      `;

      const dailyRows = await tx
        .select({
          activityDate: localDate,
          commitsCount: sql<number>`
          (count(*) FILTER (
            WHERE ${githubActivityEvents.sourceType}
              = 'commit'
          ))::int
        `,
          prsOpenedCount: sql<number>`
          (count(*) FILTER (
            WHERE ${githubActivityEvents.sourceType}
              = 'pull_request_opened'
          ))::int
        `,
          reviewsCount: sql<number>`
          (count(*) FILTER (
            WHERE ${githubActivityEvents.sourceType}
              = 'pull_request_review_submitted'
          ))::int
        `,
          issuesOpenedCount: sql<number>`
          (count(*) FILTER (
            WHERE ${githubActivityEvents.sourceType}
              = 'pull_request_opened'
          ))::int
        `,
          eligibleEventCount: sql<number>`
          count(*)::int
        `,
        })
        .from(githubActivityEvents)
        .where(
          and(
            eq(githubActivityEvents.userId, userId),
            eq(githubActivityEvents.isEligible, true),
          ),
        )
        .groupBy(localDate);

      await tx
        .delete(userDailyActivities)
        .where(eq(userDailyActivities.userId, userId));

      const completedAt = new Date();

      if (dailyRows.length > 0) {
        await tx.insert(userDailyActivities).values(
          dailyRows.map((day) => ({
            userId,
            timezone,
            activityDate: day.activityDate,
            commitsCount: day.commitsCount,
            prsOpenedCount: day.prsOpenedCount,
            reviewsCount: day.reviewsCount,
            issuesOpenedCount: day.issuesOpenedCount,
            eligibleEventCount: day.eligibleEventCount,
            recalculatedAt: completedAt,
          })),
        );
      }

      return {
        userId,
        timezone,
        daysRecalculated: dailyRows.length,
        eligibleEvents: dailyRows.reduce(
          (sum, day) => sum + day.eligibleEventCount,
          0,
        ),
        completedAt,
      };
    });
  }
}
