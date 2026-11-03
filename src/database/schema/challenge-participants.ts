import { primaryKey, snakeCase, text, timestamp } from "drizzle-orm/pg-core";

import { challenges } from "./challenges";
import { users } from "./users";

export const challengeParticipants = snakeCase.table(
  "challenge_participants",
  {
    challengeId: text()
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id),
    enrolledAt: timestamp({ withTimezone: true }).notNull(),
    leftAt: timestamp({ withTimezone: true }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.challengeId, table.userId] })],
);
