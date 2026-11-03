import { createId } from "@paralleldrive/cuid2";
import { index, snakeCase, text, timestamp } from "drizzle-orm/pg-core";

import { organizations } from "./organizations";
import { users } from "./users";

export const members = snakeCase.table(
  "members",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text().default("member").notNull(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().$onUpdate(() => new Date()),
  },
  (table) => [
    index("members_organizationId_idx").on(table.organizationId),
    index("members_userId_idx").on(table.userId),
  ],
);
