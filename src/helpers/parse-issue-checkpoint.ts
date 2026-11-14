export interface IssuesCheckpoint {
  version: 1;
  kind: "issues";
  mode: "backfill" | "incremental";
  since: string;
  until: string;
  nextPage: number;
}

export function parseIssueCheckpoint(
  raw: string | null,
): IssuesCheckpoint | null {
  if (!raw) return null;

  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("INVALID_ISSUES_CHECKPOINT");
  }

  if (!value || typeof value !== "object") {
    throw new Error("INVALID_ISSUES_CHECKPOINT");
  }

  const data = value as Partial<IssuesCheckpoint>;

  if (
    data.version !== 1 ||
    data.kind !== "issues" ||
    !["backfill", "incremental"].includes(data.mode ?? "") ||
    typeof data.since !== "string" ||
    typeof data.until !== "string" ||
    !Number.isFinite(Date.parse(data.since)) ||
    !Number.isFinite(Date.parse(data.until)) ||
    Date.parse(data.since) >= Date.parse(data.until) ||
    !Number.isSafeInteger(data.nextPage) ||
    (data.nextPage ?? 0) < 1
  ) {
    throw new Error("INVALID_ISSUES_CHECKPOINT");
  }

  return data as IssuesCheckpoint;
}
