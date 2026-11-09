# GitHub Commits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize a user's GitHub commits into `github_activity_events` through the existing BullMQ pipeline, without adding a commits table.

**Architecture:** Add a repository-scoped commit sync service that retrieves the linked GitHub token, fetches commits for repositories with enabled user access, and upserts eligible events. Extend the existing sync job routing and scheduler for repository-scoped `commits` cursors. Keep aggregation outside the sync path.

**Tech Stack:** NestJS, BullMQ, Drizzle ORM/PostgreSQL, GitHub REST API, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-github-commits-design.md`

## Global Constraints

- Reuse `github_activity_events`; do not add a dedicated commits table or migration.
- Use the existing cursor and BullMQ retry/deduplication behavior.
- Do not attribute a commit to the sync user unless the GitHub author identity matches the linked GitHub account.
- Leave daily activity aggregation to its existing subsystem.

## Review Focus

- GitHub commit without a linked author identity: skip it; test that no event is inserted.
- Commit authored by another repository contributor: do not attribute it to the syncing user; test identity matching.
- Repeated pages or repeated sync: the unique event key prevents duplicate events; test conflict upsert behavior.
- Rate limit, invalid token, malformed response, and timeout: throw stable errors so BullMQ retries; test representative error mappings.
- Repository access disabled or repository absent: do not fetch it; test the repository selection query.

---

## File map

- Create `src/modules/github/github-commits.service.ts`: token/account lookup, repository selection, GitHub API pagination, commit-to-event mapping and upsert.
- Modify `src/modules/github/github.module.ts`: provide the commits service.
- Modify `src/modules/github/github-sync-processor.ts`: dispatch `SYNC_COMMITS` jobs to the service, preserving cursor lifecycle.
- Modify `src/modules/github/github-sync.service.ts`: support repository-scoped commit enqueue/status contexts and job names.
- Modify `src/modules/github/github-sync-scheduler.service.ts`: schedule due repository-scoped commit cursors.
- Modify `src/infrastructure/queues/queue.constants.ts`: define the commits job name.
- Create focused Vitest specs for service mapping/API/persistence and pipeline dispatch.

### Task 1: Commit service mapping and persistence

**Files:**
- Create: `src/modules/github/github-commits.service.ts`
- Test: `src/modules/github/github-commits.service.spec.ts`

**Interfaces:**
- Produces: `GithubCommitsService.sync(userId: string, repositoryId: string): Promise<CommitsSyncResult>`.
- `CommitsSyncResult` reports `commitsProcessed`, `pagesFetched`, and `completedAt`.

- [ ] **Step 1: Write failing tests** for linked account/token resolution, eligible commit event mapping, author mismatch/absent identity skipping, paginated requests, and upsert idempotency.
- [ ] **Step 2: Run** `npm test -- src/modules/github/github-commits.service.spec.ts`; confirm the tests fail because the service is absent.
- [ ] **Step 3: Implement** `GithubCommitsService.sync(userId, repositoryId)` using the repository's existing default branch and enabled `user_repository_access` row. Only persist commits whose associated GitHub author ID equals the linked account's GitHub ID. Use `sourceType: "commit"`, commit SHA as `externalKey`, repository ID, author ID, commit authored timestamp, visibility, `isEligible: true`, and `eligibilityVersion: 1`. Upsert on `(userId, sourceType, externalKey)`.
- [ ] **Step 4: Run** the focused Vitest spec and confirm it passes.

### Task 2: Queue and processor integration

**Files:**
- Modify: `src/infrastructure/queues/queue.constants.ts`
- Modify: `src/modules/github/github.module.ts`
- Modify: `src/modules/github/github-sync-processor.ts`
- Test: `src/modules/github/github-sync-processor.spec.ts`

**Interfaces:**
- Consumes: `GithubCommitsService.sync(userId: string, repositoryId: string)`.
- Produces: a `sync-commits` BullMQ job accepted only with `resourceType: "commits"` and non-null `repositoryId`.

- [ ] **Step 1: Write failing tests** for valid commits job dispatch and rejection of malformed commits contexts.
- [ ] **Step 2: Run** `npm test -- src/modules/github/github-sync-processor.spec.ts`; confirm the new dispatch tests fail.
- [ ] **Step 3: Add** the job constant, register the service, and dispatch commits through `executeSync` so cursor start/success/failure behavior is shared.
- [ ] **Step 4: Run** the processor spec and confirm it passes.

### Task 3: Manual/automatic enqueue and scheduling

**Files:**
- Modify: `src/modules/github/github-sync.service.ts`
- Modify: `src/modules/github/github-sync-scheduler.service.ts`
- Test: `src/modules/github/github-sync.service.spec.ts`
- Test: `src/modules/github/github-sync-scheduler.service.spec.ts`

**Interfaces:**
- Produces: `enqueueCommitsSync(userId: string, repositoryId: string, trigger: GithubSyncTrigger)` and repository-scoped commit status support.

- [ ] **Step 1: Write failing tests** for commits job name resolution, repository-required validation, deduplication by user/resource/repository, and automatic scheduling of due `commits` cursors with non-null repository IDs.
- [ ] **Step 2: Run** the focused service and scheduler specs; confirm the new tests fail.
- [ ] **Step 3: Implement** enqueue and status routing, and extend the scheduler query to include due repository-scoped commit cursors without changing the repositories sync schedule.
- [ ] **Step 4: Run** the focused specs and confirm they pass.

### Task 4: Full verification

**Files:** all changed files.

- [ ] **Step 1: Run** `npm test` and confirm all tests pass.
- [ ] **Step 2: Run** `npm run lint` and `npm run build`; resolve any failures caused by the change.
- [ ] **Step 3: Review** the final diff against the design, especially event identity, visibility/eligibility, cursor scope, and absence of schema changes.
