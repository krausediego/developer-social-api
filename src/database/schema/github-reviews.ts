import { createId } from "@paralleldrive/cuid2";
import { bigint, snakeCase, text, timestamp } from "drizzle-orm/pg-core";

import { githubPullRequests } from "./github-pull-requests";

export const githubReviews = snakeCase.table("github_reviews", {
  id: text()
    .primaryKey()
    .$defaultFn(() => createId()),
  githubReviewId: bigint({ mode: "bigint" }).notNull(),
  pullRequestId: text()
    .notNull()
    .references(() => githubPullRequests.id, { onDelete: "cascade" }),
  reviewerGithubId: bigint({ mode: "bigint" }).notNull(),
  state: text().notNull(),
  submittedAt: timestamp({ withTimezone: true }),
  syncedAt: timestamp({ withTimezone: true }).notNull(),
});
