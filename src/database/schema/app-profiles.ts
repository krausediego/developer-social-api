import {
  bigint,
  primaryKey,
  snakeCase,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const appProfiles = snakeCase.table(
  "app_profiles",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    githubUserId: bigint({ mode: "bigint" }).unique(),
    githubLogin: text(),
    githubName: text(),
    bio: text(),
    avatarUrl: text(),
    visibility: text().notNull(),
    locale: text().notNull().default("private"),
    timezone: text().notNull().default("UTC"),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.userId] })],
);
