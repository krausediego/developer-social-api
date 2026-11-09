# GitHub commits sync design

## Intent

Implement commit synchronization for linked GitHub accounts, extending the current BullMQ sync pipeline and reusing the existing activity event schema. This makes commit activity available to existing aggregation without adding a commits table.

## Goals

- Fetch commits from repositories already discovered and accessible to the user.
- Persist commit events in `github_activity_events`, idempotently keyed by user, source type, and GitHub commit SHA.
- Record repository, GitHub author, commit timestamp, visibility, eligibility, and sync time.
- Integrate `commits` with existing job dispatch, cursor state, and automatic/manual sync triggers.
- Handle API authentication, rate limits, pagination, and retries consistently with repository sync.

## Non-goals

- Adding a dedicated commits table or changing existing migrations.
- Recalculating `user_daily_activities` in the sync service; existing aggregation remains responsible for that.
- Synchronizing commits from repositories not represented in the user's repository access records.

## Approaches

1. **Reuse `github_activity_events` (selected).** Store commit events with `sourceType = "commit"` and a stable SHA external key. This fits the current schema and unique constraint and avoids a migration.
2. **Create a dedicated commits table.** This permits commit-specific fields and richer future querying, at the cost of schema, migration, and additional data model work. Not selected because current consumers aggregate activity events.

## Behavior and implementation calls

- Follow `GithubRepositoriesService` for token retrieval and GitHub REST request conventions.
- Add a per-repository commit sync using the repository's default branch and the GitHub commits endpoint, paginating until exhausted. Use a bounded date window where supported to avoid unbounded initial sync; the cursor should preserve progress across pages/runs if the existing cursor representation supports it.
- Resolve the commit author from GitHub's associated user identity. Events without an associated GitHub user are not eligible for user activity; persist only if a stable actor ID is available, otherwise skip.
- Use repository visibility as `sourceVisibility`; determine eligibility with the project's existing eligibility rules/constants if present, otherwise keep the decision isolated for later adjustment.
- Wire the `commits` resource through `GithubSyncService`, `GithubSyncProcessor`, and the scheduler while preserving current cursor retry behavior.
- Add unit tests for event mapping/deduplication, pagination, API failures, and job dispatch.

## Constraints and open implementation details

- Existing `github_activity_events` requires `githubActorId`, `occurredAt`, `sourceVisibility`, `isEligible`, and `eligibilityVersion`; exact eligibility policy and version must follow any existing project convention discovered during implementation.
- Commit author can differ from committer, and GitHub may return no linked account for either. Treat unresolvable actor identity conservatively rather than assigning activity to the sync owner.
- API rate limits and large repositories may make a full-history scan expensive; cursor semantics and a safe initial synchronization window must be verified against the current product behavior.
