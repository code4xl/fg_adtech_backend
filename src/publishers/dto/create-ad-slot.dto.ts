// model AdInventory {
//   id               String                   @id @default(uuid()) @db.Uuid
//   publisherId      String                   @db.Uuid
//   name             String
//   width            Int
//   height           Int
//   format           InventoryFormat
//   position         InventoryPosition
//   isActive         Boolean                  @default(true)
//   viewabilityScore Float?
//   approvalStatus   ApprovalStatus           @default(PENDING)
//   createdAt        DateTime                 @default(now())
//   updatedAt        DateTime                 @updatedAt
//   websiteId        String?                  @db.Uuid // Optional, can be null if not associated with a website
//   // Relations
//   publisher        Publisher                @relation(fields: [publisherId], references: [id])
//   floorPrices      FloorPrice[]
//   bidRequests      BidRequest[]
//   targetingRules   InventoryTargetingRule[]

//   HourlyMetrics HourlyMetrics[]

//   website Website? @relation(fields: [websiteId], references: [id])
// }
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateAdSlotDto {
  @ApiProperty({
    description: 'Name of the ad slot',
    example: 'Header Banner',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Width of the ad slot in pixels',
    example: 728,
  })
  @IsNotEmpty()
  width: number;

  @ApiProperty({
    description: 'Height of the ad slot in pixels',
    example: 90,
  })
  @IsNotEmpty()
  height: number;

  @ApiProperty({
    description: 'Format of the ad slot (e.g., IMAGE, VIDEO)',
    example: 'IMAGE',
  })
  @IsNotEmpty()
  @IsString()
  format: string;

  @ApiProperty({
    description: 'Position of the ad slot (e.g., HEADER, FOOTER)',
    example: 'HEADER',
  })
  @IsNotEmpty()
  @IsString()
  position: string;

  @ApiPropertyOptional({
    description: 'Viewability score for the ad slot',
    example: 0.8,
    required: false,
  })
  @IsOptional()
  viewabilityScore?: number;

  @ApiPropertyOptional({
    description: 'Approval status of the ad slot',
    example: 'PENDING',
    required: false,
  })
  @IsOptional()
  approvalStatus?: string;

  @ApiProperty({
    description: 'Publisher ID associated with the ad slot',
    example: 'publisher-id-1234',
  })
  @IsNotEmpty()
  @IsUUID('4')
  publisherId: string;
}
