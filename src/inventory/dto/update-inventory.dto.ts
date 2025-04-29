import { PartialType } from '@nestjs/swagger';
import { CreateInventoryDto } from './create-inventory.dto';
import { IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma/client';

export class UpdateInventoryDto extends PartialType(CreateInventoryDto) {
  @ApiProperty({ 
    description: 'Whether the inventory is active',
    required: false 
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Admin-only: Update approval status',
    enum: ApprovalStatus,
    required: false
  })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;
}