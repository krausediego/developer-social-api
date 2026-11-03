import { primaryKey, snakeCase, text, timestamp } from "drizzle-orm/pg-core";

import { challenges } from "./challenges";
import { users } from "./users";

export const challengeAchievements = snakeCase.table(
  "challenge_achievements",
  {
    challengeId: text()
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id),
    status: text().notNull(),
    firstAchievedAt: timestamp({ withTimezone: true }).notNull(),
    awardedAt: timestamp({ withTimezone: true }).notNull(),
    confirmedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    lastEvaluatedAt: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.challengeId, table.userId] })],
);
