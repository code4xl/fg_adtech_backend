import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsUrl,
    IsUUID,
    IsOptional
} from 'class-validator';
import { CreativeType, CreativeStatus } from '@prisma/client';

export class CreateCreativeDto {
    @ApiProperty({
        description: 'Creative name',
        example: 'Summer Sale Banner'
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        description: 'Creative type',
        enum: CreativeType,
        example: CreativeType.IMAGE
    })
    @IsEnum(CreativeType)
    type: CreativeType;

    @ApiProperty({
        description: 'Inventory ID this creative is targeting',
        example: 'b169383a-2369-4422-9094-bf0752ceed65'
    })
    @IsUUID('4')
    @IsNotEmpty()
    inventoryId: string;

    @ApiProperty({
        description: 'Landing page URL',
        example: 'https://example.com/summer-sale'
    })
    @IsUrl()
    landingUrl: string;
}



export class CreativeResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    campaignId: string;

    @ApiProperty()
    inventoryId: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ enum: CreativeType })
    type: CreativeType;

    @ApiProperty()
    width: number;

    @ApiProperty()
    height: number;

    @ApiProperty()
    fileUrl: string;

    @ApiProperty()
    landingUrl: string;

    @ApiProperty({ enum: CreativeStatus })
    status: CreativeStatus;

    @ApiProperty({ required: false })
    reviewNotes?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

export class ApproveCreativeDto {
    @ApiProperty({
        description: 'Review notes (optional)',
        required: false
    })
    @IsOptional()
    @IsString()
    notes?: string;
}

export class RejectCreativeDto {
    @ApiProperty({
        description: 'Reason for rejection',
        example: 'Creative violates platform policies regarding adult content'
    })
    @IsString()
    @IsNotEmpty()
    reason: string;
}