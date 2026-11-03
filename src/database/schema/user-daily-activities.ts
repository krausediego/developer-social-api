import {
  date,
  integer,
  primaryKey,
  snakeCase,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const userDailyActivities = snakeCase.table(
  "user_daily_activities",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityDate: date().notNull(),
    timezone: text().notNull(),
    commitsCount: integer().notNull(),
    prsOpenedCount: integer().notNull(),
    reviewsCount: integer().notNull(),
    issuesOpenedCount: integer().notNull(),
    eligibleEventCount: integer().notNull(),
    recalculatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.activityDate, table.timezone] }),
  ],
);
