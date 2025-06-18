// import { ApiProperty } from '@nestjs/swagger';
// import {
//     IsArray,
//     IsNotEmpty,
//     IsNumber,
//     IsUUID,
//     Min,
//     ValidateNested
// } from 'class-validator';
// import { Type } from 'class-transformer';

// export class CampaignInventoryItemDto {
//     @ApiProperty({
//         description: 'Inventory ID',
//         example: 'b169383a-2369-4422-9094-bf0752ceed65'
//     })
//     @IsUUID('4')
//     @IsNotEmpty()
//     inventoryId: string;

//     @ApiProperty({
//         description: 'Maximum bid for this inventory (in USD)',
//         example: 3.5
//     })
//     @IsNumber({ maxDecimalPlaces: 2 })
//     @Min(0.01)
//     @Type(() => Number)
//     maxBid: number;
// }

// export class AddInventoryToCampaignDto {
//     @ApiProperty({
//         description: 'List of inventory items to add to campaign',
//         type: [CampaignInventoryItemDto],
//         isArray: true
//     })
//     @IsArray()
//     @ValidateNested({ each: true })
//     @Type(() => CampaignInventoryItemDto)
//     inventories: CampaignInventoryItemDto[];
// }

// export class CampaignInventoryResponseDto {
//     @ApiProperty()
//     campaignId: string;

//     @ApiProperty()
//     inventoryId: string;

//     @ApiProperty()
//     maxBid: number;

//     @ApiProperty()
//     createdAt: Date;

//     @ApiProperty()
//     updatedAt: Date;

//     @ApiProperty()
//     inventory: {
//         id: string;
//         name: string;
//         width: number;
//         height: number;
//         format: string;
//         position: string;
//     };
// }

// dto/campaign-inventory.dto.ts
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

export class InventoryItem {
    @ApiProperty({
        description: 'Inventory ID',
        example: 'b169383a-2369-4422-9094-bf0752ceed65'
    })
    @IsUUID('4')
    @IsNotEmpty()
    inventoryId: string;

    @ApiProperty({
        description: 'Maximum bid amount for this inventory',
        example: 100000
    })
    @IsNumber()
    @Min(0.01)
    maxBid: number;
}

export class AssignInventoryToCampaignDto {
    @ApiProperty({
        description: 'List of inventory items to assign to the campaign',
        type: [InventoryItem]
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => InventoryItem)
    inventories: InventoryItem[];
}

export class updateInventoryCampaignSettings {
    @ApiProperty({
        description: 'Maximum bid amount for this inventory',
        example: 100000
    })
    @IsNumber()
    maxBid: number;
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