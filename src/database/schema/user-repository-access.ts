import {
  boolean,
  primaryKey,
  snakeCase,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { githubRepositories } from "./github-repositories";
import { users } from "./users";

export const userRepositoryAccess = snakeCase.table(
  "user_repository_access",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repositoryId: text()
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    accessType: text(),
    syncEnabled: boolean().notNull(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.repositoryId] })],
);
