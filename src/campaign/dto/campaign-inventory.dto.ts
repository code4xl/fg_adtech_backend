import { ApiProperty } from '@nestjs/swagger';
import {
    IsArray,
    IsNotEmpty,
    IsNumber,
    IsUUID,
    Min,
    ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class CampaignInventoryItemDto {
    @ApiProperty({
        description: 'Inventory ID',
        example: '550e8400-e29b-41d4-a716-446655440000'
    })
    @IsUUID('4')
    @IsNotEmpty()
    inventoryId: string;

    @ApiProperty({
        description: 'Maximum bid for this inventory (in USD)',
        example: 3.5
    })
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    @Type(() => Number)
    maxBid: number;
}

export class AddInventoryToCampaignDto {
    @ApiProperty({
        description: 'List of inventory items to add to campaign',
        type: [CampaignInventoryItemDto],
        isArray: true
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CampaignInventoryItemDto)
    inventories: CampaignInventoryItemDto[];
}

export class CampaignInventoryResponseDto {
    @ApiProperty()
    campaignId: string;

    @ApiProperty()
    inventoryId: string;

    @ApiProperty()
    maxBid: number;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty()
    inventory: {
        id: string;
        name: string;
        width: number;
        height: number;
        format: string;
        position: string;
    };
}