import { ApiProperty } from '@nestjs/swagger';

export class AdSlotTemplateDto {
  @ApiProperty({
    description: 'UUID of the ad slot template',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Name of the ad slot template',
    example: 'Leaderboard 728x90',
  })
  name: string;

  @ApiProperty({
    description: 'Width of the ad slot in pixels',
    example: 728,
  })
  width: number;

  @ApiProperty({
    description: 'Height of the ad slot in pixels',
    example: 90,
  })
  height: number;

  @ApiProperty({
    description: 'Format of the ad',
    example: 'BANNER',
    enum: ['BANNER', 'NATIVE', 'VIDEO', 'RICH_MEDIA'],
  })
  format: string;

  @ApiProperty({
    description: 'Position of the ad on the page',
    example: 'ABOVE_FOLD',
    enum: ['ABOVE_FOLD', 'BELOW_FOLD', 'SIDEBAR', 'FOOTER', 'HEADER', 'IN_CONTENT'],
  })
  position: string;
}

export class AdInventoryResponseDto {
  @ApiProperty({
    description: 'UUID of the ad inventory',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Name of the ad inventory slot',
    example: 'Header Banner',
  })
  name: string;

  @ApiProperty({
    description: 'UUID of the publisher',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  publisherId: string;

  @ApiProperty({
    description: 'UUID of the website',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  websiteId: string;

  @ApiProperty({
    description: 'Whether the ad inventory is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Viewability score between 0.0 and 1.0',
    example: 0.8,
  })
  viewabilityScore: number;

  @ApiProperty({
    description: 'Approval status of the ad inventory',
    example: 'PENDING',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
  })
  approvalStatus: string;

  @ApiProperty({
    description: 'Ad slot template details',
    type: AdSlotTemplateDto,
  })
  adSlotTemplate: AdSlotTemplateDto;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}