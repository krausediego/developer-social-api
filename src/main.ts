import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import { I18nValidationExceptionFilter, I18nValidationPipe } from "nestjs-i18n";
import { Logger } from "nestjs-pino";

import { AppModule, ObserveInstrument } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    bufferLogs: true,
    bodyParser: false,
  });

  app.useLogger(app.get(Logger));

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new I18nValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(
    new I18nValidationExceptionFilter({
      detailedErrors: false,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Developer social")
    .setDescription("The developer social API")
    .setVersion("1.0")
    .addCookieAuth("better-auth.session_token", {
      type: "apiKey",
      in: "cookie",
      name: "better-auth.session_token",
    })
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, documentFactory, {
    jsonDocumentUrl: "docs-json",
  });

  app.use("/reference", apiReference({ content: documentFactory() }));

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
