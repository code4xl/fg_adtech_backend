import { ApiProperty } from '@nestjs/swagger';
import { CompanySize } from '@prisma/client';

export class AdvertiserClientResponseDto {
    @ApiProperty({ description: 'Client ID' })
    id: string;

    @ApiProperty({ description: 'Client name' })
    name: string;

    @ApiProperty({ description: 'Email address' })
    email: string;

    @ApiProperty({ description: 'Mobile number' })
    mobile: string;

    @ApiProperty({ description: 'Company name' })
    companyName: string;

    @ApiProperty({ description: 'Company headquarters location' })
    hqLocation: string;

    @ApiProperty({ description: 'Company size', enum: CompanySize })
    companySize: CompanySize;

    @ApiProperty({ description: 'Company Registered Address' })
    registeredAddress: string;

    @ApiProperty({ description: 'Company GSTIN' })
    companyGSTIN: string;

    @ApiProperty({ description: 'Company PAN' })
    PAN: string;

    @ApiProperty({ description: 'Company CIN' })
    CIN: string;

    @ApiProperty({ description: 'Company website' })
    website: string;

    @ApiProperty({ description: 'Is client active' })
    isActive: boolean;

    @ApiProperty({ description: 'Email verification date' })
    emailVerifiedAt: Date | null;

    @ApiProperty({ description: 'Advertiser ID' })
    advertiserId: string;

    @ApiProperty({ description: 'Created at' })
    createdAt: Date;

    @ApiProperty({ description: 'Updated at' })
    updatedAt: Date;
}