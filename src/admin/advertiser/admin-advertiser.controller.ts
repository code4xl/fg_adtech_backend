import {
    Controller,
    Get,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
    ParseUUIDPipe,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
    ApiResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/authorization.guard';
import {
    ApiStandardResponse,
    ApiStandardErrors,
} from '../../common/decorators/swagger.decorator';
import { AdvertiserResponseDto } from 'src/advertiser/dto/create-advertiser.dto';
import { AdvertiserQueryDto, UpdateAdvertiserStatusDto, VerifyEmailDto } from '../dto/advertiser.dto';
import { AdminAdvertiserService } from './admin-advertiser.service';


@ApiTags('Admin - Advertiser Management')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/advertisers')
export class AdminAdvertiserController {
    constructor(
        private readonly adminAdvertiserService: AdminAdvertiserService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get all advertisers with filtering and pagination' })
    @ApiStandardResponse({
        isPaginated: true,
        type: AdvertiserResponseDto,
        description: 'Advertisers retrieved successfully',
    })
    @ApiStandardErrors()
    async findAll(@Query() queryDto: AdvertiserQueryDto) {
        return this.adminAdvertiserService.findAll(queryDto);
    }

    @Get('active')
    @ApiOperation({ summary: 'Get all active advertisers' })
    @ApiStandardResponse({
        isPaginated: true,
        type: AdvertiserResponseDto,
        description: 'Active advertisers retrieved successfully',
    })
    @ApiStandardErrors()
    async findAllActive(@Query() queryDto: AdvertiserQueryDto) {
        return this.adminAdvertiserService.findAllActive(queryDto);
    }

    @Get('pending-verification')
    @ApiOperation({ summary: 'Get advertisers pending email verification' })
    @ApiStandardResponse({
        isPaginated: true,
        type: AdvertiserResponseDto,
        description: 'Pending advertisers retrieved successfully',
    })
    @ApiStandardErrors()
    async findPendingVerification(@Query() queryDto: AdvertiserQueryDto) {
        return this.adminAdvertiserService.findPendingVerification(queryDto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get advertiser by ID' })
    @ApiParam({ name: 'id', description: 'Advertiser ID', type: String })
    @ApiStandardResponse({
        type: AdvertiserResponseDto,
        description: 'Advertiser retrieved successfully',
    })
    @ApiStandardErrors()
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.adminAdvertiserService.findOne(id);
    }

    @Get(':id/campaigns')
    @ApiOperation({ summary: 'Get all campaigns for an advertiser' })
    @ApiParam({ name: 'id', description: 'Advertiser ID', type: String })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiStandardResponse({
        isPaginated: true,
        description: 'Advertiser campaigns retrieved successfully',
    })
    @ApiStandardErrors()
    async getAdvertiserCampaigns(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        return this.adminAdvertiserService.getAdvertiserCampaigns(id, page, limit);
    }

    @Get(':id/clients')
    @ApiOperation({ summary: 'Get all clients for an advertiser' })
    @ApiParam({ name: 'id', description: 'Advertiser ID', type: String })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiStandardResponse({
        isPaginated: true,
        description: 'Advertiser clients retrieved successfully',
    })
    @ApiStandardErrors()
    async getAdvertiserClients(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        return this.adminAdvertiserService.getAdvertiserClients(id, page, limit);
    }

    @Get(':id/profile-details')
    @ApiOperation({ summary: 'Get advertiser profile information' })
    @ApiParam({ name: 'id', description: 'Advertiser ID', type: String })
    @ApiStandardResponse({
        type: AdvertiserResponseDto,
        description: 'Advertiser profile details retrieved successfully',
    })
    @ApiStandardErrors()
    async getProfileDetails(@Param('id', ParseUUIDPipe) id: string) {
        return this.adminAdvertiserService.getProfileDetails(id);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update advertiser status' })
    @ApiParam({ name: 'id', description: 'Advertiser ID', type: String })
    @ApiStandardResponse({
        type: AdvertiserResponseDto,
        description: 'Advertiser status updated successfully',
    })
    @ApiStandardErrors()
    async updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateStatusDto: UpdateAdvertiserStatusDto,
    ) {
        return this.adminAdvertiserService.updateStatus(id, updateStatusDto);
    }

    @Patch('verify-email')
    @ApiOperation({ summary: 'Manually verify advertiser email by id or email' })
    @ApiStandardResponse({
        type: AdvertiserResponseDto,
        description: 'Advertiser email verified successfully',
    })
    @ApiStandardErrors()
    async verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.adminAdvertiserService.verifyEmail(dto.id, dto.email);
    }

    @Patch(':id/reset-password')
    @ApiOperation({ summary: 'Reset advertiser password' })
    @ApiParam({ name: 'id', description: 'Advertiser ID', type: String })
    @ApiStandardResponse({
        description: 'Password reset successfully',
    })
    @ApiStandardErrors()
    async resetPassword(@Param('id', ParseUUIDPipe) id: string) {
        return this.adminAdvertiserService.resetPassword(id);
    }

    @Patch(':id/disable-mfa')
    @ApiOperation({ summary: 'Disable MFA for advertiser' })
    @ApiParam({ name: 'id', description: 'Advertiser ID', type: String })
    @ApiStandardResponse({
        type: AdvertiserResponseDto,
        description: 'MFA disabled successfully',
    })
    @ApiStandardErrors()
    async disableMFA(@Param('id', ParseUUIDPipe) id: string) {
        return this.adminAdvertiserService.disableMFA(id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete advertiser' })
    @ApiParam({ name: 'id', description: 'Advertiser ID', type: String })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: 'Advertiser deleted successfully',
    })
    @ApiStandardErrors()
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.adminAdvertiserService.remove(id);
    }
}