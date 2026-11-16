export interface ReviewsCheckpoint {
  version: 1;
  kind: "reviews";
  mode: "backfill" | "incremental";
  since: string;
  until: string;
  searchPage: number;
  itemIndex: number;
  reviewPage: number;
}

export function parseReviewCheckpoint(
  raw: string | null,
  pageSize = 100,
): ReviewsCheckpoint | null {
  if (!raw) return null;

  let data: Partial<ReviewsCheckpoint>;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("INVALID_REVIEWS_CHECKPOINT");
  }

  if (
    !data ||
    data.version !== 1 ||
    data.kind !== "reviews" ||
    !["backfill", "incremental"].includes(data.mode ?? "") ||
    typeof data.since !== "string" ||
    typeof data.until !== "string" ||
    !Number.isFinite(Date.parse(data.since)) ||
    !Number.isFinite(Date.parse(data.until)) ||
    Date.parse(data.since) >= Date.parse(data.until) ||
    !Number.isSafeInteger(data.searchPage) ||
    !Number.isSafeInteger(data.itemIndex) ||
    !Number.isSafeInteger(data.reviewPage) ||
    (data.searchPage ?? 0) < 1 ||
    (data.itemIndex ?? -1) < 0 ||
    (data.itemIndex ?? 101) >= pageSize ||
    (data.reviewPage ?? 0) < 1
  ) {
    throw new Error("INVALID_REVIEWS_CHECKPOINT");
  }

  return data as ReviewsCheckpoint;
}
