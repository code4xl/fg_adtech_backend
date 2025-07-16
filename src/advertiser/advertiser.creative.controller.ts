import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    UseGuards,
    Request,
    ParseUUIDPipe,
    UseInterceptors,
    UploadedFile,
    Patch,
    Query,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
} from '@nestjs/common';
import { AdvertiserGuard } from '../common/guards/authorization.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiParam,
    ApiConsumes,
    ApiBody,
    ApiResponse,
} from '@nestjs/swagger';
import {
    ApiStandardResponse,
    ApiStandardErrors,
} from '../common/decorators/swagger.decorator';
import { CreateCreativeDto } from './dto/creative/create-creative.dto';
import { UpdateCreativeDto } from './dto/creative/update-creative.dto';
import { memoryStorage } from 'multer';
import { AdvertiserCreativeService } from './advertiser.creative.service';
import { CreativeType } from '@prisma/client';

@ApiTags('Advertiser - Creative')
@ApiBearerAuth()
@UseGuards(AdvertiserGuard)
@Controller('advertiser/:advertiserId/campaign/:campaignId/creative')
export class AdvertiserCreativeController {
    constructor(
        private readonly advertiserCreativeService: AdvertiserCreativeService,
    ) { }

    @Get('templates')
    @ApiOperation({ summary: 'Get all available ad slot templates' })
    @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
    @ApiStandardResponse({
        description: 'Ad slot templates retrieved successfully',
    })
    @ApiStandardErrors()
    getAdSlotTemplates(@Param('campaignId', ParseUUIDPipe) campaignId: string) {
        return this.advertiserCreativeService.getAdSlotTemplates();
    }

    @Post()
    @ApiOperation({ summary: 'Add a new creative to a campaign' })
    @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Creative name' },
                type: {
                    type: 'string',
                    enum: ['IMAGE', 'VIDEO', 'HTML5', 'HTML', 'RICH_MEDIA'],
                    description: 'Creative type',
                },
                templateId: { type: 'string', description: 'Ad slot template ID' },
                landingUrl: { type: 'string', description: 'Landing page URL' },
                file: {
                    type: 'string',
                    format: 'binary',
                    description:
                        'Creative file to upload (dimensions must match template)',
                },
            },
            required: ['name', 'type', 'templateId', 'landingUrl', 'file'],
        },
    })
    @ApiStandardResponse({
        description: 'Creative added successfully',
    })
    @ApiStandardErrors()
    @UseInterceptors(FileInterceptor('file'))
    addCreative(
        @Param('campaignId', ParseUUIDPipe) campaignId: string,
        @Request() req,
        @Body() createCreativeDto: CreateCreativeDto,
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
                    new FileTypeValidator({
                        fileType: /(jpg|jpeg|png|gif|webp|mp4|webm|html|zip)$/i,
                    }),
                ],
            }),
        )
        file: Express.Multer.File,
    ) {
        return this.advertiserCreativeService.addCreative(
            campaignId,
            req.user.id,
            createCreativeDto,
            file,
        );
    }

    @Patch(':creativeId')
    @ApiOperation({ summary: 'Update a creative' })
    @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
    @ApiParam({ name: 'creativeId', description: 'Creative ID', type: String })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Creative name' },
                type: { type: 'string', description: 'Creative type', enum: Object.values(CreativeType) },
                landingUrl: { type: 'string', description: 'Landing page URL' },
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Creative file to upload (optional)',
                },
            },
        },
    })
    @ApiStandardResponse({
        description: 'Creative updated successfully',
    })
    @ApiStandardErrors()
    @UseInterceptors(
        FileInterceptor('file'),
    )
    updateCreative(
        @Param('campaignId', ParseUUIDPipe) campaignId: string,
        @Param('creativeId', ParseUUIDPipe) creativeId: string,
        @Request() req,
        @Body() updateCreativeDto: UpdateCreativeDto,
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
                    new FileTypeValidator({
                        fileType: /(jpg|jpeg|png|gif|webp|mp4|webm|html|zip)$/i,
                    }),
                ],
                fileIsRequired: false,
            }),
        )
        file?: Express.Multer.File,
    ) {
        return this.advertiserCreativeService.updateCreative(
            creativeId,
            campaignId,
            req.user.id,
            updateCreativeDto,
            file,
        );
    }

    @Get()
    @ApiOperation({ summary: 'Get all creatives for a campaign' })
    @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
    @ApiStandardResponse({
        description: 'Creatives retrieved successfully',
    })
    @ApiStandardErrors()
    findAll(@Param('campaignId', ParseUUIDPipe) campaignId: string, @Request() req) {
        return this.advertiserCreativeService.getCreatives(campaignId, req.user.id);
    }

    @Get(':creativeId')
    @ApiOperation({ summary: 'Get a specific creative' })
    @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
    @ApiParam({ name: 'creativeId', description: 'Creative ID', type: String })
    @ApiStandardResponse({
        description: 'Creative retrieved successfully',
    })
    @ApiStandardErrors()
    findOne(
        @Param('campaignId', ParseUUIDPipe) campaignId: string,
        @Param('creativeId', ParseUUIDPipe) id: string,
        @Request() req,
    ) {
        return this.advertiserCreativeService.getCreative(
            id,
            campaignId,
            req.user.id,
        );
    }

    @Delete(':creativeId')
    @ApiOperation({ summary: 'Remove a creative' })
    @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
    @ApiParam({ name: 'creativeId', description: 'Creative ID', type: String })
    @ApiStandardResponse({
        description: 'Creative removed successfully',
    })
    @ApiStandardErrors()
    remove(
        @Param('campaignId', ParseUUIDPipe) campaignId: string,
        @Param('creativeId', ParseUUIDPipe) id: string,
        @Request() req,
    ) {
        return this.advertiserCreativeService.removeCreative(
            id,
            campaignId,
            req.user.id,
        );
    }

    @Get(':creativeId/presigned-url')
    @ApiOperation({ summary: 'Get a pre-signed URL for accessing a creative' })
    @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
    @ApiParam({ name: 'creativeId', description: 'Creative ID', type: String })
    @ApiResponse({
        status: 200,
        description: 'Pre-signed URL generated successfully',
        schema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'Pre-signed URL for accessing the creative',
                },
            },
        },
    })
    @ApiStandardErrors()
    async getCreativePresignedUrl(
        @Param('campaignId', ParseUUIDPipe) campaignId: string,
        @Param('creativeId', ParseUUIDPipe) creativeId: string,
        @Request() req,
        @Query('expiresIn') expiresIn: number = 3600,
    ) {
        return this.advertiserCreativeService.getCreativePresignedUrl(
            creativeId,
            campaignId,
            req.user.id,
            expiresIn,
        );
    }
}