import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, IsDate, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CompanySize } from '@prisma/client';
import { Helper } from 'src/common/utils/helper';

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
    @Matches(Helper.MOBILE, { message: 'Mobile number must be a valid 10-digit number' })
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
        enum: CompanySize,
        example: CompanySize.ONE_TO_TEN
    })
    @IsNotEmpty()
    @IsEnum(CompanySize)
    companySize: CompanySize;
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

    @ApiProperty({ enum: CompanySize })
    companySize: CompanySize;

    @ApiProperty({ required: false })
    rememberToken?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}