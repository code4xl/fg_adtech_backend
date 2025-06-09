import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { Match } from '../../common/validators/match.validator';

export class RequestPasswordResetDto {
    @ApiProperty({
        description: 'Email address of the user requesting password reset',
        example: 'user@example.com',
        type: String
    })
    @IsNotEmpty({ message: 'Email is required' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email: string;
}

export class ResetPasswordDto {
    @ApiProperty({ description: 'Email address', example: 'example@gmail.com' })
    @IsNotEmpty({ message: 'Email is required' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email: string;

    @ApiProperty({ description: 'Password' })
    @IsNotEmpty({ message: 'Password is required' })
    @IsString({ message: 'Password must be a string' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password: string;


    @ApiProperty({ description: 'Password' })
    @IsNotEmpty({ message: 'Confirm Password is required' })
    @IsString({ message: 'Password must be a string' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @Match('password', { message: 'Passwords do not match' })
    confirmPassword: string;
}