import { createId } from "@paralleldrive/cuid2";
import { boolean, snakeCase, text, timestamp } from "drizzle-orm/pg-core";

export const users = snakeCase.table("users", {
  id: text()
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().default(false).notNull(),
  image: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().$onUpdate(() => new Date()),
});
