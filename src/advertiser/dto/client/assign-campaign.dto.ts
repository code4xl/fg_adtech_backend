import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignCampaignsDto {
    @ApiProperty({
        description: 'Array of campaign IDs to assign to the client',
        example: ['uuid1', 'uuid2', 'uuid3'],
        type: [String]
    })
    @IsNotEmpty({ message: 'Campaign IDs are required' })
    @IsArray()
    @IsUUID('4', { each: true, message: 'Each campaign ID must be a valid UUID' })
    campaignIds: string[];
}