import { createId } from "@paralleldrive/cuid2";
import { index, snakeCase, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./users";

export const sessions = snakeCase.table(
  "sessions",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activeOrganizationId: text(),
    expiresAt: timestamp().notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().$onUpdate(() => new Date()),
  },
  (table) => [index("sessions_userId_idx").on(table.userId)],
);
