import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    UseGuards,
    ParseUUIDPipe,
    Query
  } from '@nestjs/common';
  import { InventoryService } from './inventory.service';
  import { AdminGuard } from '../common/guards/authorization.guard';
  import { ApprovalStatus } from '@prisma/client';
  import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiParam
  } from '@nestjs/swagger';
  import { 
    ApiStandardResponse,
    ApiStandardErrors 
  } from '../common/decorators/swagger.decorator';
  
  @ApiTags('admin/inventory')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Controller('admin/inventory')
  export class InventoryAdminController {
    constructor(private readonly inventoryService: InventoryService) {}
  
    @Get('pending')
    @ApiOperation({ summary: 'Get all pending inventory approvals' })
    @ApiStandardResponse({
      isPaginated: true,
      description: 'List of pending inventories'
    })
    @ApiStandardErrors()
    async getPendingInventories(@Query() query: any) {
      return this.inventoryService.findPendingApprovals(query);
    }
  
    @Post(':id/approve')
    @ApiOperation({ summary: 'Approve inventory' })
    @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
    @ApiStandardResponse({
      description: 'Inventory approved successfully'
    })
    @ApiStandardErrors()
    async approveInventory(@Param('id', ParseUUIDPipe) id: string) {
      return this.inventoryService.updateApprovalStatus(id, ApprovalStatus.APPROVED);
    }
  
    @Post(':id/reject')
    @ApiOperation({ summary: 'Reject inventory' })
    @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
    @ApiStandardResponse({
      description: 'Inventory rejected successfully'
    })
    @ApiStandardErrors()
    async rejectInventory(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() rejectDto: { reason: string }
    ) {
      return this.inventoryService.updateApprovalStatus(id, ApprovalStatus.REJECTED, rejectDto.reason);
    }
  }