import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsTimeZone,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { i18nValidationMessage } from "nestjs-i18n";

import { I18nTranslations } from "@/generated/i18n.generated";

enum Locale {
  PT_BR = "pt-BR",
  EN = "en",
}

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: "John due",
    nullable: true,
    maxLength: 80,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage<I18nTranslations>("validation.IS_STRING"),
  })
  @MinLength(1, {
    message: i18nValidationMessage<I18nTranslations>("validation.MIN_LENGTH"),
  })
  @MaxLength(80, {
    message: i18nValidationMessage<I18nTranslations>("validation.MAX_LENGTH"),
  })
  displayName?: string;

  @ApiPropertyOptional({
    example: "Random bio",
    nullable: true,
    maxLength: 500,
  })
  @IsString({
    message: i18nValidationMessage<I18nTranslations>("validation.IS_STRING"),
  })
  @MaxLength(500, {
    message: i18nValidationMessage<I18nTranslations>("validation.MAX_LENGTH"),
  })
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({
    enum: Locale,
    example: Locale.PT_BR,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(Locale, {
    message: i18nValidationMessage<I18nTranslations>("validation.IS_ENUM"),
  })
  locale?: Locale;

  @ApiPropertyOptional({
    example: "America/Sao_Paulo",
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsTimeZone({
    message: i18nValidationMessage<I18nTranslations>("validation.IS_TIMEZONE"),
  })
  timezone?: string;
}
