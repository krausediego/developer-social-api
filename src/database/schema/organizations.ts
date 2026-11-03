import { createId } from "@paralleldrive/cuid2";
import { snakeCase, text, timestamp } from "drizzle-orm/pg-core";

export const organizations = snakeCase.table("organizations", {
  id: text()
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text().notNull(),
  slug: text().notNull().unique(),
  logo: text(),
  metadata: text(),
  createdAt: timestamp().notNull(),
  updatedAt: timestamp().$onUpdate(() => new Date()),
});
