// src/advertiser/client/advertiser-client.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { AuthService } from 'src/auth/auth.service';
import {
  DuplicateResourceException,
  ResourceNotFoundException,
} from 'src/common/exceptions/custom.exception';
import { CreateClientDto } from './dto/client/create-client.dto';
import { UpdateClientDto } from './dto/client/update-client.dto';
import { AssignCampaignsDto } from './dto/client/assign-campaign.dto';
import * as bcrypt from 'bcryptjs';
import { UserType } from 'src/notification/dto/create-notification.dto';
import { CampaignNotificationService } from 'src/notification/services/campaign.notification.service';

@Injectable()
export class AdvertiserClientService {
  private readonly logger = new Logger(AdvertiserClientService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private readonly campaignNotificationService: CampaignNotificationService
  ) { }

  /**
   * Generate a random password
   */
  private generateRandomPassword(length: number = 12): string {
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!';
    let password = '';

    // Ensure at least one of each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Upper case
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lower case
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
    password += '@#$%&*!'[Math.floor(Math.random() * 7)]; // Special char

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password to randomize position of required characters
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Create a new client (Advertiser only)
   */
  async createClient(advertiserId: string, createClientDto: CreateClientDto) {
    this.logger.debug(`Creating client for advertiser: ${advertiserId}`);

    // Verify advertiser exists
    const advertiser = await this.prisma.advertiser.findUnique({
      where: { id: advertiserId },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
      },
    });

    if (!advertiser) {
      throw new ResourceNotFoundException('Advertiser', advertiserId);
    }

    // Check for duplicate email
    const existingEmail = await this.prisma.client.findUnique({
      where: { email: createClientDto.email },
    });

    if (existingEmail) {
      throw new DuplicateResourceException(
        'Client',
        'email',
        createClientDto.email,
      );
    }

    // Check for duplicate mobile, GSTIN, PAN, CIN
    const existingClient = await this.prisma.client.findFirst({
      where: {
        OR: [
          { mobile: createClientDto.mobile },
          { companyGSTIN: createClientDto.companyGSTIN },
          { PAN: createClientDto.PAN },
          { CIN: createClientDto.CIN },
        ],
      },
    });

    if (existingClient) {
      if (existingClient.mobile === createClientDto.mobile) {
        throw new DuplicateResourceException(
          'Client',
          'mobile number',
          createClientDto.mobile,
        );
      }
      if (existingClient.companyGSTIN === createClientDto.companyGSTIN) {
        throw new DuplicateResourceException(
          'Client',
          'GSTIN',
          createClientDto.companyGSTIN,
        );
      }
      if (existingClient.PAN === createClientDto.PAN) {
        throw new DuplicateResourceException(
          'Client',
          'PAN',
          createClientDto.PAN,
        );
      }
      if (existingClient.CIN === createClientDto.CIN) {
        throw new DuplicateResourceException(
          'Client',
          'CIN',
          createClientDto.CIN,
        );
      }
    }

    // Generate random password
    const plainTextPassword = this.generateRandomPassword(12);
    const hashedPassword = await bcrypt.hash(plainTextPassword, 10);

    // Create client in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the client with generated password
      const client = await tx.client.create({
        data: {
          name: createClientDto.name,
          email: createClientDto.email,
          mobile: createClientDto.mobile,
          companyName: createClientDto.companyName,
          hqLocation: createClientDto.hqLocation,
          companySize: createClientDto.companySize,
          registeredAddress: createClientDto.registeredAddress,
          companyGSTIN: createClientDto.companyGSTIN,
          PAN: createClientDto.PAN,
          CIN: createClientDto.CIN,
          website: createClientDto.website,
          advertiserId,
          password: hashedPassword, // Set the hashed password
        },
      });

      return client;
    });

    // Send welcome email with credentials
    try {
      await this.mailService.sendClientWelcomeEmail(
        result.email,
        result.name,
        plainTextPassword,
        advertiser.name,
        advertiser.email,
        advertiser.companyName || advertiser.name,
      );
      this.logger.debug(`Welcome email sent to client: ${result.email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email: ${error.message}`);
      // Note: We don't throw here as the client was created successfully
      // The password can be shared manually if email fails
    }

    return {
      message:
        'Client created successfully. Login credentials have been sent to their email.',
      client: {
        id: result.id,
        name: result.name,
        email: result.email,
        companyName: result.companyName,
        createdAt: result.createdAt,
      },
    };
  }

  /**
   * Get all clients for an advertiser
   */
  async getClientsByAdvertiser(advertiserId: string) {
    const clients = await this.prisma.client.findMany({
      where: { advertiserId },
      include: {
        assignedCampaigns: {
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
                status: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
        _count: {
          select: {
            assignedCampaigns: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return clients;
  }

  /**
   * Get a specific client by ID (Advertiser only)
   */
  async getClientById(advertiserId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        advertiserId,
      },
      include: {
        assignedCampaigns: {
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                status: true,
                objective: true,
                websiteUrl: true,
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!client) {
      throw new ResourceNotFoundException('Client', clientId);
    }

    return client;
  }

  /**
   * Update client information (Advertiser only)
   */
  async updateClient(
    advertiserId: string,
    clientId: string,
    updateClientDto: UpdateClientDto,
  ) {
    // Verify client exists and belongs to advertiser
    const existingClient = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        advertiserId,
      },
    });

    if (!existingClient) {
      throw new ResourceNotFoundException('Client', clientId);
    }

    // Check for unique field conflicts
    const uniqueFieldChecks: any = [];

    if (
      updateClientDto.mobile &&
      updateClientDto.mobile !== existingClient.mobile
    ) {
      uniqueFieldChecks.push({ mobile: updateClientDto.mobile });
    }
    if (
      updateClientDto.companyGSTIN &&
      updateClientDto.companyGSTIN !== existingClient.companyGSTIN
    ) {
      uniqueFieldChecks.push({ companyGSTIN: updateClientDto.companyGSTIN });
    }
    if (updateClientDto.PAN && updateClientDto.PAN !== existingClient.PAN) {
      uniqueFieldChecks.push({ PAN: updateClientDto.PAN });
    }
    if (updateClientDto.CIN && updateClientDto.CIN !== existingClient.CIN) {
      uniqueFieldChecks.push({ CIN: updateClientDto.CIN });
    }

    if (uniqueFieldChecks.length > 0) {
      const conflictingClient = await this.prisma.client.findFirst({
        where: {
          id: { not: clientId },
          OR: uniqueFieldChecks,
        },
      });

      if (conflictingClient) {
        if (conflictingClient.mobile === updateClientDto.mobile) {
          throw new DuplicateResourceException(
            'Client',
            'mobile number',
            updateClientDto.mobile,
          );
        }
        if (conflictingClient.companyGSTIN === updateClientDto.companyGSTIN) {
          throw new DuplicateResourceException(
            'Client',
            'GSTIN',
            updateClientDto.companyGSTIN,
          );
        }
        if (conflictingClient.PAN === updateClientDto.PAN) {
          throw new DuplicateResourceException(
            'Client',
            'PAN',
            updateClientDto.PAN,
          );
        }
        if (conflictingClient.CIN === updateClientDto.CIN) {
          throw new DuplicateResourceException(
            'Client',
            'CIN',
            updateClientDto.CIN,
          );
        }
      }
    }

    const updatedClient = await this.prisma.client.update({
      where: { id: clientId },
      data: updateClientDto,
    });

    return {
      message: 'Client updated successfully.',
      client: updatedClient,
    };
  }

  /**
   * Assign campaigns to a client (Advertiser only)
   */
  async assignCampaigns(
    advertiserId: string,
    clientId: string,
    assignCampaignsDto: AssignCampaignsDto,
  ) {
    // Verify client exists and belongs to advertiser
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        advertiserId,
      },
    });

    if (!client) {
      throw new ResourceNotFoundException('Client', clientId);
    }

    // Verify all campaigns exist and belong to advertiser
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        id: { in: assignCampaignsDto.campaignIds },
        advertiserId,
      },
    });

    if (campaigns.length !== assignCampaignsDto.campaignIds.length) {
      throw new BadRequestException(
        'One or more campaigns not found or do not belong to you',
      );
    }

    // Remove existing assignments and create new ones
    await this.prisma.$transaction(async (tx) => {
      // Remove existing assignments
      await tx.clientCampaign.deleteMany({
        where: { clientId },
      });

      // Create new assignments
      await tx.clientCampaign.createMany({
        data: assignCampaignsDto.campaignIds.map((campaignId) => ({
          clientId,
          campaignId,
          assignedBy: advertiserId,
        })),
      });
    });

    return {
      message: 'Campaigns assigned successfully.',
      assignedCount: assignCampaignsDto.campaignIds.length,
    };
  }

  async notifyCampaignAssignment(
    clientId: string,
    campaignIds: string[],
    advertiserId: string
  ) {
    try {
      // Get client and campaign details
      const client = await this.prisma.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          name: true,
          email: true
        }
      });

      const campaigns = await this.prisma.campaign.findMany({
        where: {
          id: { in: campaignIds },
          advertiserId: advertiserId
        },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true
        }
      });

      if (!client || campaigns.length === 0) {
        return;
      }

      const campaignNames = campaigns.map(c => c.name).join(', ');
      const isMultiple = campaigns.length > 1;

      // Create notification for client
      await this.campaignNotificationService.notificationService.createNotification({
        userId: clientId,
        userType: UserType.CLIENT,
        title: `Campaign${isMultiple ? 's' : ''} Assigned to You`,
        message: `You have been assigned to manage the following campaign${isMultiple ? 's' : ''}: ${campaignNames}. You can now monitor their performance and access detailed analytics.`,
        data: {
          campaignIds,
          campaignNames: campaigns.map(c => ({ id: c.id, name: c.name })),
          advertiserId,
          action: 'campaigns_assigned',
          assignedAt: new Date().toISOString()
        }
      });

      // Create notification for advertiser
      await this.campaignNotificationService.notificationService.createNotification({
        userId: advertiserId,
        userType: UserType.ADVERTISER,
        title: `Campaign${isMultiple ? 's' : ''} Assigned to Client`,
        message: `Your campaign${isMultiple ? 's' : ''} ${campaignNames} ${isMultiple ? 'have' : 'has'} been successfully assigned to ${client.name}.`,
        data: {
          campaignIds,
          campaignNames: campaigns.map(c => ({ id: c.id, name: c.name })),
          clientId,
          clientName: client.name,
          action: 'campaigns_assigned_to_client',
          assignedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error sending campaign assignment notification:', error);
    }
  }
}
