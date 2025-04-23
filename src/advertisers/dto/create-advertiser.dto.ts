import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AdvertiserCompanySize {
    ONE_TO_TEN = 'ONE_TO_TEN', // 1-10
    ELEVEN_TO_FIFTY = 'ELEVEN_TO_FIFTY', // 11-50
    FIFTY_ONE_TO_TWO_HUNDRED = 'FIFTY_ONE_TO_TWO_HUNDRED', // 51-200
    TWO_HUNDRED_ONE_TO_FIVE_HUNDRED = 'TWO_HUNDRED_ONE_TO_FIVE_HUNDRED', // 201-500
    FIVE_HUNDRED_ONE_TO_ONE_THOUSAND = 'FIVE_HUNDRED_ONE_TO_ONE_THOUSAND', // 501-1000
    ONE_THOUSAND_AND_ABOVE = 'ONE_THOUSAND_AND_ABOVE', // 1001+
}

export class CreateAdvertiserDto {
    @ApiProperty({ description: 'Advertiser name' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ description: 'Email address', example: 'example@email.com' })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({ description: 'Password' })
    @IsNotEmpty()
    @IsString()
    password: string;

    @ApiProperty({ description: 'Mobile number' })
    @IsNotEmpty()
    @IsPhoneNumber()
    mobile: string;

    @ApiProperty({ description: 'Company name' })
    @IsNotEmpty()
    @IsString()
    companyName: string;

    @ApiProperty({ description: 'Company headquarters location' })
    @IsNotEmpty()
    @IsString()
    hqLocation: string;

    @ApiProperty({
        description: 'Company size',
        enum: AdvertiserCompanySize,
        example: AdvertiserCompanySize.ONE_TO_TEN
    })
    @IsNotEmpty()
    @IsEnum(AdvertiserCompanySize)
    companySize: AdvertiserCompanySize;

    @ApiProperty({ description: 'Remember token', required: false })
    @IsOptional()
    @IsString()
    rememberToken?: string;
}

export class AdvertiserResponseDto {
    @ApiProperty()
    id: number;

    @ApiProperty()
    name: string;

    @ApiProperty()
    email: string;

    @ApiProperty()
    emailVerifiedAt: Date;

    @ApiProperty()
    mobile: string;

    @ApiProperty()
    companyName: string;

    @ApiProperty()
    hqLocation: string;

    @ApiProperty({ enum: AdvertiserCompanySize })
    companySize: AdvertiserCompanySize;

    @ApiProperty({ required: false })
    rememberToken?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}