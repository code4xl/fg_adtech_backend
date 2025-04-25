import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';

export class LoginDto {
    @ApiProperty({ description: 'user@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ description: 'password123' })
    @IsString()
    @IsNotEmpty()
    password: string;

    // Role is now optional as it will be determined by the endpoint used
    // @ApiProperty({ example: 'advertiser', enum: ['advertiser', 'publisher'], required: false })
    // @IsString()
    // @IsIn(['advertiser', 'publisher'])
    // @IsOptional()
    // role?: 'advertiser' | 'publisher';
}