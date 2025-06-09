import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdvertiserStatus, CompanySize } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AdvertiserQueryDto, UpdateAdvertiserStatusDto } from '../dto/advertiser.dto';


@Injectable()
export class AdminAdvertiserService {
    constructor(private readonly prisma: PrismaService) { }

    // Done
    async findAll(queryDto: AdvertiserQueryDto) {
        const {
            page = 1,
            limit = 10,
            search,
            status,
            companySize,
            isEmailVerified,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = queryDto;

        const skip = (page - 1) * limit;

        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { companyName: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (status) {
            where.status = status;
        }

        if (companySize) {
            where.companySize = companySize;
        }

        if (isEmailVerified !== undefined) {
            where.emailVerifiedAt = isEmailVerified ? { not: null } : null;
        }

        const [advertisers, total] = await Promise.all([
            this.prisma.advertiser.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: sortOrder },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    emailVerifiedAt: true,
                    mobile: true,
                    companyName: true,
                    hqLocation: true,
                    companySize: true,
                    status: true,
                    mfaEnabled: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: {
                            Campaign: true,
                            clients: true,
                        },
                    },
                },
            }),
            this.prisma.advertiser.count({ where }),
        ]);

        return {
            success: true,
            data: {
                items: advertisers,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            },
            message: 'Advertisers retrieved successfully',
        };
    }

    // Done
    async findAllActive(queryDto: AdvertiserQueryDto) {
        return this.findAll({ ...queryDto, status: AdvertiserStatus.ACTIVE });
    }

    // Done
    async findPendingVerification(queryDto: AdvertiserQueryDto) {
        return this.findAll({ ...queryDto, isEmailVerified: false });
    }

    // Done
    async findOne(id: string) {
        const advertiser = await this.prisma.advertiser.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                emailVerifiedAt: true,
                mobile: true,
                companyName: true,
                hqLocation: true,
                companySize: true,
                status: true,
                mfaEnabled: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        Campaign: true,
                        clients: true,
                        bidResponses: true,
                    },
                },
            },
        });

        if (!advertiser) {
            throw new NotFoundException('Advertiser not found');
        }

        return {
            success: true,
            data: advertiser,
            message: 'Advertiser retrieved successfully',
        };
    }

    // Done
    async getAdvertiserCampaigns(id: string, page: number = 1, limit: number = 10) {
        const advertiser = await this.prisma.advertiser.findUnique({
            where: { id },
        });

        if (!advertiser) {
            throw new NotFoundException('Advertiser not found');
        }

        const skip = (page - 1) * limit;

        const [campaigns, total] = await Promise.all([
            this.prisma.campaign.findMany({
                where: { advertiserId: id },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: {
                            creatives: true,
                        },
                    },
                },
            }),
            this.prisma.campaign.count({ where: { advertiserId: id } }),
        ]);

        return {
            success: true,
            data: {
                items: campaigns,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            },
            message: 'Advertiser campaigns retrieved successfully',
        };
    }

    // Done
    async getAdvertiserClients(id: string, page: number = 1, limit: number = 10) {
        const advertiser = await this.prisma.advertiser.findUnique({
            where: { id },
        });

        if (!advertiser) {
            throw new NotFoundException('Advertiser not found');
        }

        const skip = (page - 1) * limit;

        const [clients, total] = await Promise.all([
            this.prisma.client.findMany({
                where: { advertiserId: id },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.client.count({ where: { advertiserId: id } }),
        ]);

        return {
            success: true,
            data: {
                items: clients,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            },
            message: 'Advertiser clients retrieved successfully',
        };
    }

    // Done
    async getProfileDetails(id: string) {
        const advertiser = await this.prisma.advertiser.findUnique({
            where: { id },
            include: {
                Campaign: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        startDate: true,
                        endDate: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                clients: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                _count: {
                    select: {
                        Campaign: true,
                        clients: true,
                        bidResponses: true,
                    },
                },
            },
        });

        if (!advertiser) {
            throw new NotFoundException('Advertiser not found');
        }

        return {
            success: true,
            data: advertiser,
            message: 'Advertiser profile details retrieved successfully',
        };
    }

    // Done
    async updateStatus(id: string, updateStatusDto: UpdateAdvertiserStatusDto) {
        const advertiser = await this.prisma.advertiser.findUnique({
            where: { id },
        });

        if (!advertiser) {
            throw new NotFoundException('Advertiser not found');
        }

        const updatedAdvertiser = await this.prisma.advertiser.update({
            where: { id },
            data: { status: updateStatusDto.status },
            select: {
                id: true,
                name: true,
                email: true,
                status: true,
                updatedAt: true,
            },
        });

        return {
            success: true,
            data: updatedAdvertiser,
            message: `Advertiser status updated to ${updateStatusDto.status}`,
        };
    }

    // Done
    async verifyEmail(id: string, email: string) {
        if (!id && !email) {
            throw new BadRequestException('Either id or email must be provided');
        }

        const advertiser = await this.prisma.advertiser.findFirst({
            where: {
                OR: [
                    { id },
                    { email },
                ],
            },
        });


        if (!advertiser) {
            throw new NotFoundException('Advertiser not found');
        }

        if (advertiser.emailVerifiedAt) {
            throw new BadRequestException('Email is already verified');
        }

        const updatedAdvertiser = await this.prisma.advertiser.update({
            where: { id: advertiser.id },
            data: {
                emailVerifiedAt: new Date(),
                verificationToken: null,
            },
            select: {
                id: true,
                name: true,
                email: true,
                emailVerifiedAt: true,
                updatedAt: true,
            },
        });

        return {
            success: true,
            data: updatedAdvertiser,
            message: 'Email verified successfully',
        };
    }

    // Done
    async resetPassword(id: string) {
        const advertiser = await this.prisma.advertiser.findUnique({
            where: { id },
        });

        if (!advertiser) {
            throw new NotFoundException('Advertiser not found');
        }

        // Generate new temporary password
        const tempPassword = randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        await this.prisma.advertiser.update({
            where: { id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null,
            },
        });

        return {
            success: true,
            data: { temporaryPassword: tempPassword },
            message: 'Password reset successfully. Temporary password generated.',
        };
    }

    // Done
    async disableMFA(id: string) {
        const advertiser = await this.prisma.advertiser.findUnique({
            where: { id },
        });

        if (!advertiser) {
            throw new NotFoundException('Advertiser not found');
        }

        const updatedAdvertiser = await this.prisma.advertiser.update({
            where: { id },
            data: {
                mfaEnabled: false,
                mfaVerificationCode: null,
                mfaCodeExpiry: null,
            },
            select: {
                id: true,
                name: true,
                email: true,
                mfaEnabled: true,
                updatedAt: true,
            },
        });

        return {
            success: true,
            data: updatedAdvertiser,
            message: 'MFA disabled successfully',
        };
    }

    // Done
    async remove(id: string) {
        const advertiser = await this.prisma.advertiser.findUnique({
            where: { id },
        });

        if (!advertiser) {
            throw new NotFoundException('Advertiser not found');
        }

        // Soft delete by updating status
        await this.prisma.advertiser.update({
            where: { id },
            data: { status: AdvertiserStatus.INACTIVE },
        });

        return {
            success: true,
            message: 'Advertiser deleted successfully',
        };
    }
}