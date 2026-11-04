import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";

const isProduction = process.env.NODE_ENV === "production";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
        transport: isProduction
          ? undefined
          : {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:standard",
                singleLine: true,
              },
            },
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers.set-cookie",
            "*.accessToken",
            "*.refreshToken",
            "*.clientSecret",
            "*.password",
          ],
          censor: "[REDACTED]",
        },
      },
    }),
  ],
})
export class LoggingModule {}
