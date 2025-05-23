import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateCreativeDto } from './create-creative.dto';
import { IsEnum, IsNotEmpty, IsString, IsUrl, IsUUID } from 'class-validator';
import { CreativeType } from '@prisma/client';

export class UpdateCreativeDto {
    @ApiProperty({
        description: 'Creative name',
        example: 'Summer Sale Banner'
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        description: 'Landing page URL',
        example: 'https://example.com/summer-sale'
    })
    @IsUrl()
    landingUrl: string;
}
