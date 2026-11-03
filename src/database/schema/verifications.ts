import { createId } from "@paralleldrive/cuid2";
import { index, snakeCase, text, timestamp } from "drizzle-orm/pg-core";

export const verifications = snakeCase.table(
  "verifications",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().$onUpdate(() => new Date()),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);
