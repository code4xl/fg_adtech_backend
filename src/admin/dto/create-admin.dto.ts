import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateAdminDto {
    @ApiProperty({ description: 'Admin name' })
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

    @ApiProperty({ description: 'Remember token', required: false })
    @IsOptional()
    @IsString()
    rememberToken?: string;
}
