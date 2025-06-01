// model Website {
//     id              String            @id @default(uuid()) @db.Uuid
//     url             String?           @unique
//     websiteName     String?           @unique
//     createdAt       DateTime          @default(now())
//     updatedAt       DateTime          @updatedAt
//     publisherId     String
//     publisher       Publisher         @relation(fields: [publisherId], references: [id], onDelete: Cascade)
//     adInventories   AdInventory[] // Relationship with AdInventory/AdSlots
//     WebsiteCategory WebsiteCategory[]

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

//     @@unique([url, publisherId]) // Ensure unique URL per publisher
// }
export class CreateWebsiteDto {
  @ApiProperty({
    description: 'URL of the website',
    example: 'https://example.com',
  })
  @IsNotEmpty()
  @IsString()
  url: string;

  @ApiProperty({
    description: 'Name of the website',
    example: 'Example Website',
  })
  @IsOptional()
  @IsString()
  websiteName?: string;

  @ApiProperty({ description: 'Publisher ID associated with the website' })
  @IsNotEmpty()
  @IsString()
  publisherId: string;
}
