import { Module } from "@nestjs/common";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";

import { auth } from "@/modules/auth";
import { CreateProfileHook } from "@/modules/auth/hooks";

@Module({
  imports: [
    BetterAuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: "2mb" },
        urlencoded: { limit: "2mb", extended: true },
        rawBody: true,
      },
    }),
  ],
  providers: [CreateProfileHook],
})
export class AuthModule {}
