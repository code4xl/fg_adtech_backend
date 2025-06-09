import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ClientLoginDto {
    @ApiProperty({ description: 'Client email address', example: 'client@example.com' })
    @IsNotEmpty({ message: 'Email is required' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email: string;

    @ApiProperty({ description: 'Client password', example: 'SecurePassword123!' })
    @IsNotEmpty({ message: 'Password is required' })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    password: string;
}