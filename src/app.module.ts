import { Module } from "@nestjs/common";
import { createObserveModule } from "@nestjs/observe";

import { DatabaseModule } from "@/database";
import { AppI18nModule } from "@/i18n";
import { LoggingModule } from "@/infrastructure/logging";
import { AuthModule } from "@/modules/auth";
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
    LoggingModule,
    AppI18nModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
