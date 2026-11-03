import {
  integer,
  primaryKey,
  snakeCase,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { challenges } from "./challenges";
import { users } from "./users";

export const challengeProgress = snakeCase.table(
  "challenge_progress",
  {
    challengeId: text()
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id),
    currentValue: integer().notNull(),
    currentStreak: integer(),
    longesStreak: integer(),
    computedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.challengeId, table.userId] })],
);
