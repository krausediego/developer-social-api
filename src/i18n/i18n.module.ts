import { join } from "node:path";

import { Module } from "@nestjs/common";
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nJsonLoader,
  I18nModule,
  QueryResolver,
} from "nestjs-i18n";

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: "pt-BR",
      fallbacks: {
        pt: "pt-BR",
        "pt-*": "pt-BR",
        "en-*": "en",
      },
      loader: I18nJsonLoader,
      loaderOptions: {
        path: join(__dirname),
        watch: process.env.NODE_ENV === "development",
      },
      typesOutputPath: join(process.cwd(), "src/generated/i18n.generated.ts"),
      resolvers: [
        new QueryResolver(["lang"]),
        new HeaderResolver(["x-lang"]),
        AcceptLanguageResolver,
      ],
    }),
  ],
  exports: [I18nModule],
})
export class AppI18nModule {}
