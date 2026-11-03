import { primaryKey, snakeCase, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./users";

export const userFollows = snakeCase.table(
  "user_follows",
  {
    followerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followedId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.followerId, table.followedId] })],
);
