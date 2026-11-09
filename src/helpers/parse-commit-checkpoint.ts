export interface CommitBackfillCheckpoint {
  version: 1;
  kind: "commits-backfill";
  since: string;
  until: string;
  nextPage: number;
}

export function parseCommitCheckpoint(
  raw: string | null,
): CommitBackfillCheckpoint | null {
  if (!raw) return null;

  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("INVALID_COMMITS_CHECKPOINT");
  }

  if (typeof value !== "object" || value === null) {
    throw new Error("INVALID_COMMITS_CHECKPOINT");
  }

  const data = value as Partial<CommitBackfillCheckpoint>;

  if (
    data.version !== 1 ||
    data.kind !== "commits-backfill" ||
    typeof data.since !== "string" ||
    typeof data.until !== "string" ||
    !Number.isFinite(Date.parse(data.since)) ||
    !Number.isFinite(Date.parse(data.until)) ||
    Date.parse(data.since) >= Date.parse(data.until) ||
    !Number.isSafeInteger(data.nextPage) ||
    (data.nextPage ?? 0) < 1
  ) {
    throw new Error("INVALID_COMMITS_CHECKPOINT");
  }

  return data as CommitBackfillCheckpoint;
}
