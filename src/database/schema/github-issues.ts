import { createId } from "@paralleldrive/cuid2";
import {
  bigint,
  integer,
  snakeCase,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { githubRepositories } from "./github-repositories";

export const githubIssues = snakeCase.table(
  "github_issues",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    githubIssueId: bigint({ mode: "bigint" }).unique().notNull(),
    repositoryId: text()
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    number: integer().notNull(),
    authorGithubId: bigint({ mode: "bigint" }).notNull(),
    state: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    closedAt: timestamp({ withTimezone: true }),
    syncedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [unique().on(table.repositoryId, table.number)],
);
