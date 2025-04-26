import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';

export class LoginDto {
    @ApiProperty({ description: 'user@example.com' })
    @IsEmail()
    @IsNotEmpty({ message: 'Email is required' })
    email: string;

    @ApiProperty({ description: 'password123' })
    @IsString()
    @IsNotEmpty({ message: 'Password is required' })
    password: string;
}