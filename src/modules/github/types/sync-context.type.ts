import type { resourceTypes } from "@/database/schema";

export type GithubSyncResource = (typeof resourceTypes.enumValues)[number];

export interface GithubSyncContext {
  userId: string;
  resourceType: GithubSyncResource;
  repositoryId: string | null;
}

export type GithubSyncTrigger = "manual" | "automatic";
