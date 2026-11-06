import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, Matches } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

import { I18nTranslations } from "@/generated/i18n.generated";

export class GetPublicProfilesParamsDto {
  @ApiProperty({
    example: "johndue",
  })
  @IsNotEmpty({
    message: i18nValidationMessage<I18nTranslations>("validation.IS_NOT_EMPTY"),
  })
  @Matches(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/, {
    message: i18nValidationMessage<I18nTranslations>("validation.IS_ENUM"),
  })
  githubLogin!: string;
}
