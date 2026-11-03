import { createId } from "@paralleldrive/cuid2";
import { boolean, snakeCase, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./users";

export const appProfiles = snakeCase.table("app_profiles", {
  id: text()
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  username: text().notNull(),
  displayName: text().notNull(),
  bio: text(),
  location: text(),
  websiteUrl: text(),
  publicEmail: text(),
  isProfilePublic: boolean().notNull().default(true),
  showActivity: boolean().notNull().default(true),
  showRepositories: boolean().notNull().default(true),
  showStreak: boolean().notNull().default(true),
  preferredLanguage: text().notNull().default("pt-BR"),
  timezone: text().notNull().default("UTC"),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().$onUpdate(() => new Date()),
});
