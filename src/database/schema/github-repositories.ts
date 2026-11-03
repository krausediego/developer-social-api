import { createId } from "@paralleldrive/cuid2";
import {
  bigint,
  boolean,
  snakeCase,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const githubRepositories = snakeCase.table("github_repositories", {
  id: text()
    .primaryKey()
    .$defaultFn(() => createId()),
  githubRepoId: bigint({ mode: "bigint" }).unique().notNull(),
  ownerGithubId: bigint({ mode: "bigint" }).notNull(),
  name: text().notNull(),
  fullName: text().notNull(),
  visibility: text().notNull(),
  defaultBranch: text(),
  isFork: boolean().notNull(),
  isArchived: boolean().notNull(),
  pushedAt: timestamp({ withTimezone: true }),
  githubUpdatedAt: timestamp({ withTimezone: true }),
  lastSyncedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().$onUpdate(() => new Date()),
});
