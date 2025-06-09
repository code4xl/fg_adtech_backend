import { ApiProperty } from '@nestjs/swagger';
import { CompanySize } from '@prisma/client';
import {
    IsString,
    IsEmail,
    IsEnum,
    IsNotEmpty,
    Matches,
    IsArray,
    IsOptional,
    IsUUID,
} from 'class-validator';
import { Helper } from 'src/common/utils/helper';

export class CreateClientDto {
    @ApiProperty({ description: 'Client name', example: 'John Doe' })
    @IsNotEmpty({ message: 'Name is required' })
    @IsString()
    name: string;

    @ApiProperty({ description: 'Email address', example: 'client@example.com' })
    @IsNotEmpty({ message: 'Email is required' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email: string;

    @ApiProperty({ description: 'Mobile number', example: '9876543210' })
    @IsNotEmpty({ message: 'Mobile number is required' })
    @IsString()
    @Matches(Helper.MOBILE, { message: 'Mobile number must be a valid 10-digit number' })
    mobile: string;

    @ApiProperty({ description: 'Company name', example: 'ABC Corp' })
    @IsNotEmpty({ message: 'Company name is required' })
    @IsString()
    companyName: string;

    @ApiProperty({ description: 'Company headquarters location', example: 'Mumbai, Maharashtra' })
    @IsNotEmpty({ message: 'HQ location is required' })
    @IsString()
    hqLocation: string;

    @ApiProperty({
        description: 'Company size',
        enum: CompanySize,
        example: CompanySize.ONE_TO_TEN,
    })
    @IsNotEmpty({ message: 'Company size is required' })
    @IsEnum(CompanySize, { message: 'Company size must be a valid value' })
    companySize: CompanySize;

    @ApiProperty({ description: 'Company Registered Address', example: '123 Business Street, Mumbai' })
    @IsNotEmpty({ message: 'Registered address is required' })
    @IsString()
    registeredAddress: string;

    @ApiProperty({ description: 'Company GSTIN', example: '27ABCDE1234F1Z5' })
    @IsNotEmpty({ message: 'Company GSTIN is required' })
    @IsString()
    @Matches(Helper.GSTIN, {
        message: 'Please provide a valid GSTIN',
    })
    companyGSTIN: string;

    @ApiProperty({ description: 'Company PAN', example: 'ABCDE1234F' })
    @IsNotEmpty({ message: 'PAN is required' })
    @IsString()
    @Matches(Helper.PAN, {
        message: 'Please provide a valid PAN number',
    })
    PAN: string;

    @ApiProperty({ description: 'Company CIN', example: 'U72900MH2020PTC123456' })
    @IsNotEmpty({ message: 'CIN is required' })
    @IsString()
    @Matches(Helper.CIN, {
        message: 'Please provide a valid CIN',
    })
    CIN: string;

    @ApiProperty({ description: 'Company website', example: 'https://www.example.com' })
    @IsNotEmpty({ message: 'Website is required' })
    @IsString()
    website: string;
}