import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdvertiserCompanySize } from '@prisma/client';

export class UpdateAdvertiserDto {
    @ApiProperty({ description: 'Advertiser name', required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ description: 'Email address', example: 'example@email.com', required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ description: 'Password', required: false })
    @IsOptional()
    @IsString()
    password?: string;

    @ApiProperty({ description: 'Mobile number', required: false })
    @IsOptional()
    @IsPhoneNumber()
    mobile?: string;

    @ApiProperty({ description: 'Company name', required: false })
    @IsOptional()
    @IsString()
    companyName?: string;

    @ApiProperty({ description: 'Company headquarters location', required: false })
    @IsOptional()
    @IsString()
    hqLocation?: string;

    @ApiProperty({
        description: 'Company size',
        enum: AdvertiserCompanySize,
        example: AdvertiserCompanySize.ONE_TO_TEN,
        required: false
    })
    @IsOptional()
    @IsEnum(AdvertiserCompanySize)
    companySize?: AdvertiserCompanySize;

    @ApiProperty({ description: 'Remember token', required: false })
    @IsOptional()
    @IsString()
    rememberToken?: string;
}
