import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    ParseUUIDPipe
} from '@nestjs/common';
import { CreativeService } from './creative.service';
import { AdminGuard } from '../common/guards/authorization.guard';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiParam,
    ApiResponse
} from '@nestjs/swagger';
import {
    ApiStandardResponse,
    ApiStandardErrors
} from '../common/decorators/swagger.decorator';
import { ApproveCreativeDto, RejectCreativeDto } from './dto/create-creative.dto';

@ApiTags('admin/creative')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/creative')
export class AdminCreativeController {
    constructor(private readonly creativeService: CreativeService) { }

    @Get()
    @ApiOperation({ summary: 'Get all creatives pending review' })
    @ApiStandardResponse({
        description: 'Creatives retrieved successfully'
    })
    @ApiStandardErrors()
    async getPendingCreatives() {
        // Find all creatives with PENDING_REVIEW status
        return this.creativeService.getPendingCreatives();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get creative details' })
    @ApiParam({ name: 'creativeId', description: 'Creative ID', type: String })
    @ApiStandardResponse({
        description: 'Creative details retrieved successfully'
    })
    @ApiStandardErrors()
    async getCreative(@Param('id', ParseUUIDPipe) id: string) {
        return this.creativeService.getCreativeForAdmin(id);
    }

    @Post(':id/approve')
    @ApiOperation({ summary: 'Approve a creative' })
    @ApiParam({ name: 'creativeId', description: 'Creative ID', type: String })
    @ApiResponse({ status: 200, description: 'Creative approved successfully' })
    @ApiStandardErrors()
    async approveCreative(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() approveDto: ApproveCreativeDto
    ) {
        return this.creativeService.approveCreative(id, approveDto.notes);
    }

    @Post(':id/reject')
    @ApiOperation({ summary: 'Reject a creative' })
    @ApiParam({ name: 'creativeId', description: 'Creative ID', type: String })
    @ApiResponse({ status: 200, description: 'Creative rejected successfully' })
    @ApiStandardErrors()
    async rejectCreative(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() rejectDto: RejectCreativeDto
    ) {
        return this.creativeService.rejectCreative(id, rejectDto.reason);
    }
}