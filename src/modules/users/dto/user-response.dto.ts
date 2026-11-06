import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class GithubIdentityDto {
  @ApiProperty({
    example: "12345678",
    nullable: true,
  })
  id!: string | null;

  @ApiProperty({
    example: "johndue",
    nullable: true,
  })
  login!: string | null;

  @ApiProperty({
    example: "John Due",
    nullable: true,
  })
  name!: string | null;

  @ApiProperty({
    example: "http://......",
    nullable: true,
  })
  avatarUrl!: string | null;
}

export class ProfileResponseDto {
  @ApiPropertyOptional({
    example: "John",
    nullable: true,
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    nullable: true,
  })
  bio!: string | null;

  @ApiProperty({
    enum: ["private", "public"],
    example: "private",
  })
  visibility!: "private" | "public";

  @ApiProperty({ example: "pt-BR" })
  locale!: string;

  @ApiProperty({ example: "America/Sao_Paulo" })
  timezone!: string;

  @ApiProperty({
    type: String,
    format: "date-time",
    nullable: true,
  })
  publishedAt!: string | null;
}

export class UserResponseDto {
  @ApiProperty({ example: "clxyz123" })
  id!: string;

  @ApiProperty({ example: "John Due" })
  name!: string;

  @ApiProperty({ example: "john@due.com" })
  email!: string;

  @ApiProperty({ type: () => GithubIdentityDto })
  github!: GithubIdentityDto;

  @ApiProperty({ type: () => ProfileResponseDto })
  profile!: ProfileResponseDto;
}
