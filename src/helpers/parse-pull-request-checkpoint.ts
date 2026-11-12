export interface PullRequestsCheckpoint {
  version: 1;
  kind: "pull-requests";
  mode: "backfill" | "incremental";
  since: string;
  until: string;
  nextPage: number;
}

export function parsePullRequestCheckpoint(
  raw: string | null,
): PullRequestsCheckpoint | null {
  if (!raw) return null;

  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("INVALID_PULL_REQUESTS_CHECKPOINT");
  }

  if (typeof value !== "object" || value === null) {
    throw new Error("INVALID_PULL_REQUESTS_CHECKPOINT");
  }

  const data = value as Partial<PullRequestsCheckpoint>;

  if (
    data.version !== 1 ||
    data.kind !== "pull-requests" ||
    (data.mode !== "backfill" && data.mode !== "incremental") ||
    typeof data.since !== "string" ||
    typeof data.until !== "string" ||
    !Number.isFinite(Date.parse(data.since)) ||
    !Number.isFinite(Date.parse(data.until)) ||
    Date.parse(data.since) >= Date.parse(data.until) ||
    typeof data.nextPage !== "number" ||
    !Number.isSafeInteger(data.nextPage) ||
    data.nextPage < 1
  ) {
    throw new Error("INVALID_PULL_REQUESTS_CHECKPOINT");
  }

  return data as PullRequestsCheckpoint;
}
