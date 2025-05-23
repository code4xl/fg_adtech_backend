// src/notification/dto/notification.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsNotEmpty, IsEnum, IsOptional, IsObject } from 'class-validator';

export enum UserType {
    ADVERTISER = 'ADVERTISER',
    PUBLISHER = 'PUBLISHER',
    CLIENT = 'CLIENT',
    ADMIN = 'ADMIN',
}

export class CreateNotificationDto {
    @ApiProperty({ description: 'User ID to send notification to' })
    @IsUUID()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ description: 'Type of user', enum: UserType })
    @IsEnum(UserType)
    @IsNotEmpty()
    userType: UserType;

    @ApiProperty({ description: 'Notification title' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ description: 'Notification message' })
    @IsString()
    @IsNotEmpty()
    message: string;

    @ApiProperty({ description: 'Additional data', required: false })
    @IsOptional()
    @IsObject()
    data?: Record<string, any>;
}

export class BroadcastNotificationDto {
    @ApiProperty({
        description: 'The type of user to broadcast the notification to',
        enum: UserType,
        example: UserType.ADVERTISER
    })
    @IsNotEmpty({ message: 'User type is required' })
    @IsEnum(UserType, { message: 'Invalid user type' })
    userType: UserType;

    @ApiProperty({
        description: 'The title of the notification',
        example: 'Campaign Approval'
    })
    @IsNotEmpty({ message: 'Title is required' })
    @IsString({ message: 'Title must be a string' })
    title: string;

    @ApiProperty({
        description: 'The message content of the notification',
        example: 'Your campaign has been approved and is now active.'
    })
    @IsNotEmpty({ message: 'Message is required' })
    @IsString({ message: 'Message must be a string' })
    message: string;

    @ApiProperty({
        description: 'Optional additional data for the notification',
        required: false,
        example: { campaignId: '550e8400-e29b-41d4-a716-446655440000' }
    })
    @IsOptional()
    data?: Record<string, any>;
}

export class NotificationResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    message: string;

    @ApiProperty()
    isRead: boolean;

    @ApiProperty({ required: false })
    data?: Record<string, any>;

    @ApiProperty()
    createdAt: Date;
}

export class UpdateNotificationDto {
    @ApiProperty({ description: 'Mark as read status' })
    @IsNotEmpty()
    isRead: boolean;
}

export class TestNotificationDto {
    @ApiProperty({ description: 'User type to test', enum: UserType })
    @IsEnum(UserType)
    @IsNotEmpty()
    userType: UserType;

    @ApiProperty({ description: 'Title of test notification' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ description: 'Message for test notification' })
    @IsString()
    @IsNotEmpty()
    message: string;
}