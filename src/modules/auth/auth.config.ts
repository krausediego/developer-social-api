import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, oauthPopup, openAPI, organization } from "better-auth/plugins";

import { db } from "@/database";
import * as schema from "@/database/schema";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: "http://localhost:3000",
  trustedOrigins: [process.env.FRONTEND_BASE_URL!],
  plugins: [organization(), openAPI(), oauthPopup(), bearer()],
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  advanced: {
    database: {
      generateId: false,
    },
    disableOriginCheck: true,
  },
  account: {
    encryptOAuthTokens: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scope: ["read:user", "user:email"],
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
});
