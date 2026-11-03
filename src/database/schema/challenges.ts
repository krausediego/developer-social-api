import { createId } from "@paralleldrive/cuid2";
import { integer, snakeCase, text, timestamp } from "drizzle-orm/pg-core";

import { organizations } from "./organizations";
import { users } from "./users";

export const challenges = snakeCase.table("challenges", {
  id: text()
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text()
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdByUserId: text()
    .notNull()
    .references(() => users.id),
  title: text().notNull(),
  description: text(),
  type: text().notNull(),
  targetValue: integer().notNull(),
  timezone: text().notNull(),
  startsAt: timestamp({ withTimezone: true }).notNull(),
  endsAt: timestamp({ withTimezone: true }).notNull(),
  status: text().notNull(),
  canceledAt: timestamp({ withTimezone: true }),
  createdAt: timestamp().notNull(),
  updatedAt: timestamp().$onUpdate(() => new Date()),
});
