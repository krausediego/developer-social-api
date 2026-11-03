import { createId } from "@paralleldrive/cuid2";
import {
  integer,
  snakeCase,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { githubRepositories } from "./github-repositories";
import { users } from "./users";

export const githubSyncCursors = snakeCase.table(
  "github_sync_cursors",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repositoryId: text().references(() => githubRepositories.id),
    resourceType: text().notNull(),
    cursor: text(),
    etag: text(),
    status: text().notNull(),
    lastAttemptAt: timestamp({ withTimezone: true }),
    lastSuccessAt: timestamp({ withTimezone: true }),
    nextSyncAt: timestamp({ withTimezone: true }),
    retryCount: integer().notNull(),
    errorCode: text(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    unique()
      .on(table.userId, table.repositoryId, table.resourceType)
      .nullsNotDistinct(),
  ],
);
