CREATE TABLE "accounts" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "app_profiles" (
	"user_id" text PRIMARY KEY,
	"github_user_id" bigint UNIQUE,
	"github_login" text,
	"github_name" text,
	"bio" text,
	"avatar_url" text,
	"visibility" text NOT NULL,
	"locale" text DEFAULT 'private' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "challenge_progress" (
	"challenge_id" text,
	"user_id" text,
	"current_value" integer NOT NULL,
	"current_streak" integer,
	"longes_streak" integer,
	"computed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "challenge_progress_pkey" PRIMARY KEY("challenge_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "challenge_achievements" (
	"challenge_id" text,
	"user_id" text,
	"status" text NOT NULL,
	"first_achieved_at" timestamp with time zone NOT NULL,
	"awarded_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_evaluated_at" timestamp with time zone,
	CONSTRAINT "challenge_achievements_pkey" PRIMARY KEY("challenge_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "challenge_participants" (
	"challenge_id" text,
	"user_id" text,
	"enrolled_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "challenge_participants_pkey" PRIMARY KEY("challenge_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"target_value" integer NOT NULL,
	"timezone" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "github_activity_events" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"repository_id" text,
	"source_type" text NOT NULL,
	"external_key" text NOT NULL,
	"github_actor_id" bigint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"source_visibility" text NOT NULL,
	"is_eligible" boolean NOT NULL,
	"eligibility_version" integer NOT NULL,
	"synced_at" timestamp with time zone NOT NULL,
	CONSTRAINT "github_activity_events_user_id_source_type_external_key_unique" UNIQUE("user_id","source_type","external_key")
);
--> statement-breakpoint
CREATE TABLE "github_issues" (
	"id" text PRIMARY KEY,
	"github_issue_id" bigint NOT NULL UNIQUE,
	"repository_id" text NOT NULL,
	"number" integer NOT NULL,
	"author_github_id" bigint NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"synced_at" timestamp with time zone NOT NULL,
	CONSTRAINT "github_issues_repository_id_number_unique" UNIQUE("repository_id","number")
);
--> statement-breakpoint
CREATE TABLE "github_pull_requests" (
	"id" text PRIMARY KEY,
	"github_pr_id" bigint NOT NULL,
	"repository_id" text NOT NULL,
	"number" integer NOT NULL,
	"author_github_id" bigint NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"merged_at" timestamp with time zone,
	"synced_at" timestamp with time zone NOT NULL,
	CONSTRAINT "github_pull_requests_repository_id_number_unique" UNIQUE("repository_id","number")
);
--> statement-breakpoint
CREATE TABLE "github_repositories" (
	"id" text PRIMARY KEY,
	"github_repo_id" bigint NOT NULL UNIQUE,
	"owner_github_id" bigint NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"visibility" text NOT NULL,
	"default_branch" text,
	"is_fork" boolean NOT NULL,
	"is_archived" boolean NOT NULL,
	"pushed_at" timestamp with time zone,
	"github_updated_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "github_reviews" (
	"id" text PRIMARY KEY,
	"github_review_id" bigint NOT NULL,
	"pull_request_id" text NOT NULL,
	"reviewer_github_id" bigint NOT NULL,
	"state" text NOT NULL,
	"submitted_at" timestamp with time zone,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_sync_cursors" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"repository_id" text,
	"resource_type" text NOT NULL,
	"cursor" text,
	"etag" text,
	"status" text NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"next_sync_at" timestamp with time zone,
	"retry_count" integer NOT NULL,
	"error_code" text,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "github_sync_cursors_user_id_repository_id_resource_type_unique" UNIQUE NULLS NOT DISTINCT("user_id","repository_id","resource_type")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"logo" text,
	"metadata" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "repository_languages" (
	"repository_id" text,
	"language" text,
	"bytes" bigint NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "repository_languages_pkey" PRIMARY KEY("repository_id","language")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_daily_activities" (
	"user_id" text,
	"activity_date" date,
	"timezone" text,
	"commits_count" integer NOT NULL,
	"prs_opened_count" integer NOT NULL,
	"reviews_count" integer NOT NULL,
	"issues_opened_count" integer NOT NULL,
	"eligible_event_count" integer NOT NULL,
	"recalculated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_daily_activities_pkey" PRIMARY KEY("user_id","activity_date","timezone")
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"follower_id" text,
	"followed_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "user_follows_pkey" PRIMARY KEY("follower_id","followed_id")
);
--> statement-breakpoint
CREATE TABLE "user_repository_access" (
	"user_id" text,
	"repository_id" text,
	"access_type" text,
	"sync_enabled" boolean NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_repository_access_pkey" PRIMARY KEY("user_id","repository_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "github_activity_events_user_id_occurred_at_index" ON "github_activity_events" ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "github_activity_events_repository_id_occurred_at_index" ON "github_activity_events" ("repository_id","occurred_at");--> statement-breakpoint
CREATE INDEX "invitations_organizationId_idx" ON "invitations" ("organization_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" ("email");--> statement-breakpoint
CREATE INDEX "members_organizationId_idx" ON "members" ("organization_id");--> statement-breakpoint
CREATE INDEX "members_userId_idx" ON "members" ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" ("identifier");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app_profiles" ADD CONSTRAINT "app_profiles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "challenge_progress" ADD CONSTRAINT "challenge_progress_challenge_id_challenges_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "challenge_progress" ADD CONSTRAINT "challenge_progress_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "challenge_achievements" ADD CONSTRAINT "challenge_achievements_challenge_id_challenges_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "challenge_achievements" ADD CONSTRAINT "challenge_achievements_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_challenge_id_challenges_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "github_activity_events" ADD CONSTRAINT "github_activity_events_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "github_activity_events" ADD CONSTRAINT "github_activity_events_Swqie2dAjLa5_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id");--> statement-breakpoint
ALTER TABLE "github_issues" ADD CONSTRAINT "github_issues_repository_id_github_repositories_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_repository_id_github_repositories_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "github_reviews" ADD CONSTRAINT "github_reviews_pull_request_id_github_pull_requests_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "github_pull_requests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "github_sync_cursors" ADD CONSTRAINT "github_sync_cursors_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "github_sync_cursors" ADD CONSTRAINT "github_sync_cursors_repository_id_github_repositories_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id");--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "repository_languages" ADD CONSTRAINT "repository_languages_repository_id_github_repositories_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_daily_activities" ADD CONSTRAINT "user_daily_activities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followed_id_users_id_fkey" FOREIGN KEY ("followed_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_repository_access" ADD CONSTRAINT "user_repository_access_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_repository_access" ADD CONSTRAINT "user_repository_access_0y0VOXUGsvOV_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id") ON DELETE CASCADE;