import { ApiProperty, OmitType, PickType } from "@nestjs/swagger";

import { GithubIdentityDto, ProfileResponseDto } from "@/modules/users/dto";

export class PickedProfileResponseDto extends PickType(ProfileResponseDto, [
  "displayName",
  "bio",
  "publishedAt",
] as const) {}

export class PickedGithubIdentityResponseDto extends OmitType(
  GithubIdentityDto,
  ["id"] as const,
) {}

export class ProfileStatsResponse {
  @ApiProperty({
    example: 12,
  })
  currentStreak!: number;

  @ApiProperty({
    example: 35,
  })
  longestStreak!: number;

  @ApiProperty({
    example: 428,
  })
  totalCommits!: number;

  @ApiProperty({
    example: 42,
  })
  totalPullRequests!: number;

  @ApiProperty({
    example: 18,
  })
  totalIssues!: number;

  @ApiProperty({
    example: 67,
  })
  totalReviews!: number;
}

export class PublicProfileResponseDto {
  @ApiProperty({ example: "clxyz123" })
  id!: string;

  @ApiProperty({ type: () => PickedGithubIdentityResponseDto })
  github!: PickedGithubIdentityResponseDto;

  @ApiProperty({ type: () => PickedProfileResponseDto })
  profile!: PickedProfileResponseDto;

  @ApiProperty({ type: () => ProfileStatsResponse })
  stats!: ProfileStatsResponse;
}
