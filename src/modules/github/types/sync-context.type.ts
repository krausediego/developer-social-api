export type GithubSyncResources =
  | "repositories"
  | "commits"
  | "pull_requests"
  | "issues"
  | "reviews"
  | "languages";

export interface GithubSyncContext {
  userId: string;
  resourceType: GithubSyncContext;
  repositoryId: string | null;
}

export type GithubSyncTrigger = "manual" | "automatic";
