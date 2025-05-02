import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CampaignStatus } from '@prisma/client';
import { ResourceNotFoundException } from 'src/common/exceptions/custom.exception';

@Injectable()
export class CampaignHelperService {
    constructor(private readonly prisma: PrismaService) { }

    // Method to validate campaign dates
    async validateCampaignDates(startDate: Date | string, endDate: Date | string) {
        // Convert to Date objects if strings are provided
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Get current date and set time to beginning of day (00:00:00)
        const today = new Date();

        // Validate start date is not in the past
        if (start < today) {
            throw new BadRequestException('Campaign start date cannot be in the past');
        }

        // Validate end date is after start date if provided

        if (end <= start) {
            throw new BadRequestException('Campaign end date must be after start date');
        }
    }

    // Method to validate client access
    async validateClient(clientId: string, advertiserId: string) {
        const client = await this.prisma.client.findUnique({
            where: { id: clientId },
            select: { id: true, advertiserId: true }
        });

        if (!client) {
            throw new ResourceNotFoundException('Client', clientId);
        }

        if (client.advertiserId !== advertiserId) {
            throw new ForbiddenException('You do not have access to this client');
        }
    }

    // Method to validate bid strategy
    async validateBidStrategy(bidStrategy: string, bidAmount: number | undefined) {
        // If using BID_CAP or COST_CAP, bid amount is required
        if (['BID_CAP', 'COST_CAP', 'TARGET_COST'].includes(bidStrategy) && bidAmount === undefined) {
            throw new BadRequestException(`Bid amount is required for ${bidStrategy} strategy`);
        }
    }

    // Method to validate status transition
    async validateStatusTransition(currentStatus: string, newStatus: CampaignStatus) {
        // Define valid status transitions
        const validTransitions = {
            'DRAFT': ['SCHEDULED', 'ACTIVE', 'CANCELED'],
            'SCHEDULED': ['ACTIVE', 'PAUSED', 'CANCELED'],
            'ACTIVE': ['PAUSED', 'COMPLETED', 'CANCELED', 'BUDGET_EXHAUSTED'],
            'PAUSED': ['ACTIVE', 'COMPLETED', 'CANCELED'],
            'COMPLETED': [], // Terminal state
            'CANCELED': [], // Terminal state
            'REJECTED': [], // Terminal state
            'BUDGET_EXHAUSTED': ['ACTIVE'] // Can only go to active if budget is increased
        };

        // Check if transition is valid
        if (!validTransitions[currentStatus].includes(newStatus)) {
            throw new BadRequestException(
                `Invalid status transition from ${currentStatus} to ${newStatus}`
            );
        }
    }
}
