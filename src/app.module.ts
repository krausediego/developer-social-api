import { Module } from "@nestjs/common";
import { createObserveModule } from "@nestjs/observe";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";

import { DatabaseModule } from "@/database";
import { AppI18nModule } from "@/i18n";
import { LoggingModule } from "@/infrastructure/logging";
import { QueuesModule } from "@/infrastructure/queues";
import { AuthModule } from "@/modules/auth";
import { GithubModule } from "@/modules/github";
import { ProfilesModule } from "@/modules/profiles";
import { UsersModule } from "@/modules/users";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ObserveModule.forRoot({
      appKey: "NESTJS_OBSERVE_APP_KEY",
      appSecret: "NESTJS_OBSERVE_APP_SECRET",
      serviceId: "developer-social",
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 30,
      },
    ]),
    ScheduleModule.forRoot(),
    LoggingModule,
    AppI18nModule,
    QueuesModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    GithubModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
