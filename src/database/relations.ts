import { defineRelations } from "drizzle-orm";

import * as schema from "@/database/schema";

export const relations = defineRelations(schema, (r) => ({
  users: {
    sessions: r.many.sessions(),
    accounts: r.many.accounts(),
    members: r.many.members(),
    invitations: r.many.invitations(),
    appProfiles: r.many.appProfiles(),
    userFollows: r.many.userFollows(),
    userRepositoryAccess: r.many.userRepositoryAccess(),
    githubActivityEvents: r.many.githubActivityEvents(),
    githubSyncCursors: r.many.githubSyncCursors(),
    userDailyActivities: r.many.userDailyActivities(),
    challengeParticipants: r.many.challengeParticipants(),
    challengeProgress: r.many.challengeProgress(),
    challengeAchievements: r.many.challengeAchievements(),
  },
  sessions: {
    user: r.one.users({
      from: [r.sessions.userId],
      to: [r.users.id],
    }),
  },
  accounts: {
    user: r.one.users({
      from: [r.accounts.userId],
      to: [r.users.id],
    }),
  },
  organizations: {
    members: r.many.members(),
    invitations: r.many.invitations(),
    challenges: r.many.challenges(),
  },
  members: {
    organization: r.one.organizations({
      from: [r.members.organizationId],
      to: [r.organizations.id],
    }),
    user: r.one.users({
      from: [r.members.userId],
      to: [r.users.id],
    }),
  },
  invitations: {
    organization: r.one.organizations({
      from: [r.invitations.organizationId],
      to: [r.organizations.id],
    }),
    user: r.one.users({
      from: [r.invitations.inviterId],
      to: [r.users.id],
    }),
  },
  appProfiles: {
    user: r.one.users({
      from: [r.appProfiles.userId],
      to: [r.users.id],
    }),
  },
  userFollows: {
    user: r.one.users({
      from: [r.userFollows.followedId],
      to: [r.users.id],
    }),
  },
  githubRepositories: {
    userRepositoryAccess: r.many.userRepositoryAccess(),
    repositoryLanguages: r.many.repositoryLanguages(),
    githubPullRequests: r.many.githubPullRequests(),
    githubActivityEvents: r.many.githubActivityEvents(),
    githubSyncCursors: r.many.githubSyncCursors(),
  },
  userRepositoryAccess: {
    user: r.one.users({
      from: [r.userRepositoryAccess.userId],
      to: [r.users.id],
    }),
    githubRepository: r.one.githubRepositories({
      from: [r.userRepositoryAccess.repositoryId],
      to: [r.githubRepositories.id],
    }),
  },
  repositoryLanguages: {
    githubRepository: r.one.githubRepositories({
      from: [r.repositoryLanguages.repositoryId],
      to: [r.githubRepositories.id],
    }),
  },
  githubPullRequests: {
    githubReviews: r.many.githubReviews(),
    githubRepository: r.one.githubRepositories({
      from: [r.githubPullRequests.repositoryId],
      to: [r.githubRepositories.id],
    }),
  },
  githubIssues: {
    githubRepository: r.one.githubRepositories({
      from: [r.githubIssues.repositoryId],
      to: [r.githubRepositories.id],
    }),
  },
  githubReviews: {
    githubPullRequest: r.one.githubPullRequests({
      from: [r.githubReviews.pullRequestId],
      to: [r.githubPullRequests.id],
    }),
  },
  githubActivityEvents: {
    user: r.one.users({
      from: [r.githubActivityEvents.userId],
      to: [r.users.id],
    }),
    githubRepository: r.one.githubRepositories({
      from: [r.githubActivityEvents.repositoryId],
      to: [r.githubRepositories.id],
    }),
  },
  githubSyncCursors: {
    user: r.one.users({
      from: [r.githubSyncCursors.userId],
      to: [r.users.id],
    }),
    githubRepository: r.one.githubRepositories({
      from: [r.githubSyncCursors.repositoryId],
      to: [r.githubRepositories.id],
    }),
  },
  userDailyActivities: {
    user: r.one.users({
      from: [r.userDailyActivities.userId],
      to: [r.users.id],
    }),
  },
  challenges: {
    challengeParticipants: r.many.challengeParticipants(),
    challengeProgress: r.many.challengeProgress(),
    challengeAchievements: r.many.challengeAchievements(),
    organization: r.one.organizations({
      from: [r.challenges.organizationId],
      to: [r.organizations.id],
    }),
  },
  challengeParticipants: {
    challenge: r.one.challenges({
      from: [r.challengeParticipants.challengeId],
      to: [r.challenges.id],
    }),
    user: r.one.users({
      from: [r.challengeParticipants.userId],
      to: [r.users.id],
    }),
  },
  challengeProgress: {
    challenge: r.one.challenges({
      from: [r.challengeProgress.challengeId],
      to: [r.challenges.id],
    }),
    user: r.one.users({
      from: [r.challengeProgress.userId],
      to: [r.users.id],
    }),
  },
  challengeAchievements: {
    challenge: r.one.challenges({
      from: [r.challengeAchievements.challengeId],
      to: [r.challenges.id],
    }),
    user: r.one.users({
      from: [r.challengeAchievements.userId],
      to: [r.users.id],
    }),
  },
}));
