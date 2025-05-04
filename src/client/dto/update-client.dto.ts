import { IsEmail, IsEnum, IsNotEmpty, IsString, Matches, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CompanySize } from '@prisma/client';
import { Helper } from 'src/common/utils/helper';


export class UpdateClientDto {
    @ApiProperty({ description: 'Client name' })
    @IsNotEmpty({ message: 'Name is required' })
    @IsString()
    name: string;

    @ApiProperty({ description: 'Mobile number' })
    @IsNotEmpty({ message: 'Mobile number is required' })
    @IsString()
    @Matches(Helper.MOBILE, { message: 'Mobile number must be a valid 10-digit number' })
    mobile: string;

    @ApiProperty({ description: 'Company name' })
    @IsNotEmpty({ message: 'Company name is required' })
    @IsString()
    companyName: string;

    @ApiProperty({ description: 'Company headquarters location' })
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

    @ApiProperty({ description: 'Company Registered Address' })
    @IsNotEmpty({ message: 'Registered address is required' })
    @IsString()
    registeredAddress: string;

    @ApiProperty({ description: 'Company GSTIN' })
    @IsNotEmpty({ message: 'Company GSTIN is required' })
    @IsString()
    @Matches(Helper.GSTIN, {
        message: 'Please provide a valid GSTIN',
    })
    companyGSTIN: string;

    @ApiProperty({ description: 'Company PAN' })
    @IsNotEmpty({ message: 'PAN is required' })
    @IsString()
    @Matches(Helper.PAN, {
        message: 'Please provide a valid PAN number',
    })
    PAN: string;

    @ApiProperty({ description: 'Company CIN' })
    @IsNotEmpty({ message: 'CIN is required' })
    @IsString()
    @Matches(Helper.CIN, {
        message: 'Please provide a valid CIN',
    })
    CIN: string;

    @ApiProperty({ description: 'Company website' })
    @IsNotEmpty({ message: 'Website is required' })
    @IsString()
    website: string;
}
