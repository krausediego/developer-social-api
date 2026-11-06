import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

import { I18nTranslations } from "@/generated/i18n.generated";

enum Visibility {
  PUBLIC = "public",
  PRIVATE = "private",
}

export class UpdateProfileVisibilityDto {
  @ApiProperty({
    example: "public",
  })
  @IsEnum(Visibility, {
    message: i18nValidationMessage<I18nTranslations>("validation.IS_ENUM"),
  })
  visibility!: Visibility;
}
