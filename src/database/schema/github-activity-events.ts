import { createId } from "@paralleldrive/cuid2";
import {
  bigint,
  boolean,
  index,
  integer,
  snakeCase,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { githubRepositories } from "./github-repositories";
import { users } from "./users";

export const githubActivityEvents = snakeCase.table(
  "github_activity_events",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repositoryId: text().references(() => githubRepositories.id),
    sourceType: text().notNull(),
    externalKey: text().notNull(),
    githubActorId: bigint({ mode: "bigint" }).notNull(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    sourceVisibility: text().notNull(),
    isEligible: boolean().notNull(),
    eligibilityVersion: integer().notNull(),
    syncedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    unique().on(table.userId, table.sourceType, table.externalKey),
    index().on(table.userId, table.occurredAt),
    index().on(table.repositoryId, table.occurredAt),
  ],
);
