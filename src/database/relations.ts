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
      from: [r.userFollows.followeeId],
      to: [r.users.id],
    }),
  },
}));
