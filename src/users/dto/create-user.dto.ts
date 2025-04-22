import { IsNotEmpty, IsBoolean, IsEmail } from 'class-validator';

export class CreateUserDto {
    @IsNotEmpty()
    firstName: string;

    @IsNotEmpty()
    lastName: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsBoolean()
    isActive: boolean;
}
