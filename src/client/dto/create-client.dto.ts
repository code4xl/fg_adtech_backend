import {
  IsString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enum for company size - matching the Prisma enum
export enum CompanySize {
  ONE_TO_TEN = 'ONE_TO_TEN',
  ELEVEN_TO_FIFTY = 'ELEVEN_TO_FIFTY',
  FIFTY_ONE_TO_TWO_HUNDRED = 'FIFTY_ONE_TO_TWO_HUNDRED',
  TWO_HUNDRED_ONE_TO_FIVE_HUNDRED = 'TWO_HUNDRED_ONE_TO_FIVE_HUNDRED',
  FIVE_HUNDRED_ONE_TO_ONE_THOUSAND = 'FIVE_HUNDRED_ONE_TO_ONE_THOUSAND',
  ONE_THOUSAND_AND_ABOVE = 'ONE_THOUSAND_AND_ABOVE',
}

export class CreateClientDto {
  @ApiProperty({ description: 'Client name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Client email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Client mobile number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{10}$/, {
    message: 'Mobile number must be a valid 10-digit number',
  })
  mobile: string;

  @ApiProperty({ description: 'Company name' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ description: 'Company headquarters location' })
  @IsString()
  @IsNotEmpty()
  hqLocation: string;

  @ApiProperty({
    description: 'Company size',
    enum: CompanySize,
    example: CompanySize.ONE_TO_TEN,
  })
  @IsEnum(CompanySize)
  @IsNotEmpty()
  companySize: CompanySize;

  @ApiProperty({ description: 'Company registered address' })
  @IsString()
  @IsNotEmpty()
  registeredAddress: string;

  @ApiPropertyOptional({
    description: 'Goods and Services Tax Identification Number',
    example: '29AADCB2230M1ZT',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'GSTIN must be in valid format',
  })
  gstin?: string;

  @ApiPropertyOptional({
    description: 'Corporate Identity Number',
    example: 'U72200KA2009PTC000000',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[LUF][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/, {
    message: 'CIN must be in valid format',
  })
  cin?: string;

  @ApiPropertyOptional({
    description: 'Permanent Account Number',
    example: 'ABCDE1234F',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'PAN must be in valid format',
  })
  pan?: string;

  @ApiProperty({ description: 'Advertiser ID' })
  @IsString()
  @IsNotEmpty()
  advertiserId: string;
}
