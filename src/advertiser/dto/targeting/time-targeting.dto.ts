import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsDate,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TimeSlot, DayOfWeek, HolidayType } from '@prisma/client';

export class CreateCampaignTimeTargetingDto {
    @ApiProperty({ description: 'Campaign ID for targeting rules' })
    @IsUUID()
    campaignId: string;

    @ApiPropertyOptional({
        description: 'Timezone for targeting',
        default: 'Asia/Kolkata',
        example: 'Asia/Kolkata',
    })
    @IsOptional()
    @IsString()
    timezone?: string = 'Asia/Kolkata';

    @ApiPropertyOptional({
        description: 'Time slots to target',
        enum: TimeSlot,
        isArray: true,
        example: [TimeSlot.MORNING, TimeSlot.EVENING],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(TimeSlot, { each: true })
    timeSlots?: TimeSlot[];

    @ApiPropertyOptional({
        description: 'Days of week to target',
        enum: DayOfWeek,
        isArray: true,
        example: [DayOfWeek.MONDAY, DayOfWeek.FRIDAY],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(DayOfWeek, { each: true })
    daysOfWeek?: DayOfWeek[];

    @ApiPropertyOptional({
        description: 'Holiday types to include/exclude',
        enum: HolidayType,
        isArray: true,
        example: [HolidayType.NATIONAL_HOLIDAYS],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(HolidayType, { each: true })
    holidayTypes?: HolidayType[];

    @ApiPropertyOptional({
        description: 'Start hour (0-23)',
        minimum: 0,
        maximum: 23,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(23)
    startHour?: number;

    @ApiPropertyOptional({
        description: 'End hour (0-23)',
        minimum: 0,
        maximum: 23,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(23)
    endHour?: number;

    @ApiPropertyOptional({ description: 'Campaign start date' })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    startDate?: Date;

    @ApiPropertyOptional({ description: 'Campaign end date' })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    endDate?: Date;

    @ApiPropertyOptional({
        description: 'Include holidays in targeting',
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    includeHolidays?: boolean = true;

    @ApiPropertyOptional({
        description: 'Target only working days',
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    workingDaysOnly?: boolean = false;
}

export class UpdateCampaignTimeTargetingDto extends CreateCampaignTimeTargetingDto { }
