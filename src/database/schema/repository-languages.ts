import {
  bigint,
  primaryKey,
  snakeCase,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { githubRepositories } from "./github-repositories";

export const repositoryLanguages = snakeCase.table(
  "repository_languages",
  {
    repositoryId: text()
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    language: text().notNull(),
    bytes: bigint({ mode: "bigint" }).notNull(),
    fetchedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.repositoryId, table.language] })],
);
