import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

import { ClientStatus, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ClientFilterDto, ClientListResponseDto, ClientResponseDto, CreateClientDto, UpdateClientDto, ClientCampaignSummaryDto, ClientStatisticsDto, BulkActionDto } from '../dto/client.dto';


@Injectable()
export class AdminClientService {
    constructor(private readonly prisma: PrismaService) { }

    // Done
    async getAllClients(filters: ClientFilterDto) {
        const {
            page = 1,
            limit = 10,
            search,
            advertiserId,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = filters;

        const skip = (page - 1) * limit;
        const take = limit;

        // Build where clause
        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { companyName: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (advertiserId) {
            where.advertiserId = advertiserId;
        }

        // Build orderBy clause
        const orderBy: Prisma.ClientOrderByWithRelationInput = {};
        orderBy[sortBy] = sortOrder;

        const [clients, total] = await Promise.all([
            this.prisma.client.findMany({
                where,
                skip,
                take,
                orderBy,
                include: {
                    advertiser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            companyName: true,
                        },
                    },
                    _count: {
                        select: {
                            Campaign: true,
                        },
                    },
                },
            }),
            this.prisma.client.count({ where }),
        ]);

        return {
            data: clients,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // Done
    async getClientById(id: string) {
        const client = await this.prisma.client.findUnique({
            where: { id },
            include: {
                advertiser: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        companyName: true,
                        mobile: true,
                    },
                },
                _count: {
                    select: {
                        Campaign: true,
                    },
                },
            },
        });

        if (!client) {
            throw new NotFoundException('Client not found');
        }

        return client;
    }

    // Done
    async deleteClient(id: string) {
        const client = await this.prisma.client.findUnique({
            where: { id },
            include: {
                Campaign: {
                    where: {
                        status: {
                            in: ['ACTIVE', 'DRAFT'],
                        },
                    },
                },
            },
        });

        if (!client) {
            throw new NotFoundException('Client not found');
        }

        if (client.Campaign.length > 0) {
            throw new ConflictException('Cannot delete client with active campaigns');
        }

        await this.prisma.client.delete({
            where: { id },
        });

        return 'Client deleted successfully';
    }

    // Done
    async associateAdvertiser(clientId: string, advertiserId: string) {
        const [client, advertiser] = await Promise.all([
            this.prisma.client.findUnique({ where: { id: clientId } }),
            this.prisma.advertiser.findUnique({ where: { id: advertiserId } }),
        ]);

        if (!client) {
            throw new NotFoundException('Client not found');
        }

        if (!advertiser) {
            throw new NotFoundException('Advertiser not found');
        }

        const updatedClient = await this.prisma.client.update({
            where: { id: clientId },
            data: { advertiserId },
            include: {
                advertiser: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        companyName: true,
                        mobile: true,
                    },
                },
                _count: {
                    select: {
                        Campaign: true,
                    },
                },
            },
        });

        return updatedClient;
    }

    // Done
    async removeAdvertiserAssociation(clientId: string) {
        const client = await this.prisma.client.findUnique({
            where: { id: clientId },
        });

        if (!client) {
            throw new NotFoundException('Client not found');
        }

        const updatedClient = await this.prisma.client.update({
            where: { id: clientId },
            data: { advertiserId: null },
            include: {
                advertiser: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        companyName: true,
                        mobile: true,
                    },
                },
                _count: {
                    select: {
                        Campaign: true,
                    },
                },
            },
        });

        return updatedClient;
    }

    // Done
    async updateClientStatus(clientId: string, status: ClientStatus) {
        const client = await this.prisma.client.findUnique({
            where: { id: clientId },
        });

        if (!client) {
            throw new NotFoundException('Client not found');
        }

        const updatedClient = await this.prisma.client.update({
            where: { id: clientId },
            data: { updatedAt: new Date(), status },
            include: {
                advertiser: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        companyName: true,
                        mobile: true,
                    },
                },
                _count: {
                    select: {
                        Campaign: true,
                    },
                },
            },
        });

        return updatedClient;
    }
}