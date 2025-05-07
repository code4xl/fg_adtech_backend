import { Injectable } from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DuplicateResourceException, ResourceNotFoundException } from 'src/common/exceptions/custom.exception';
import { MailService } from 'src/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class ClientService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private configService: ConfigService,
    private jwtService: JwtService,
    private authService: AuthService,
  ) { }

  async create(advertiserId: string, createClientDto: CreateClientDto) {
    // Check if advertiser exists
    const advertiser = await this.prisma.advertiser.findUnique({
      where: { id: advertiserId },
    });

    if (!advertiser) {
      throw new ResourceNotFoundException('Advertiser', advertiserId);
    }

    // Check for duplicate email
    const existingEmail = await this.prisma.client.findUnique({
      where: { email: createClientDto.email },
    });
    if (existingEmail) {
      throw new DuplicateResourceException("client", "email", createClientDto.email);
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
        throw new DuplicateResourceException('client', 'mobile number', createClientDto.mobile);
      }
      if (existingClient.companyGSTIN === createClientDto.companyGSTIN) {
        throw new DuplicateResourceException('client', 'GSTIN', createClientDto.companyGSTIN);
      }
      if (existingClient.PAN === createClientDto.PAN) {
        throw new DuplicateResourceException('client', 'PAN', createClientDto.PAN);
      }
      if (existingClient.CIN === createClientDto.CIN) {
        throw new DuplicateResourceException('client', 'CIN', createClientDto.CIN);
      }
    }

    // Create the client
    const client = await this.prisma.client.create({
      data: {
        ...createClientDto,
        advertiserId,
        password: null,
      },
    });

    console.log("Client");
    console.log(client);

    // Generate password reset token and send email
    let res = await this.authService.requestPasswordReset(client.email, 'client');
    console.log(res);


    return {
      message: 'Client created successfully. Please check your email to reset your password.',
      client,
    };
  }

  async findAllByAdvertiser(advertiserId: string) {
    return await this.prisma.client.findMany({
      where: { advertiserId },
    });
  }

  async findOne(advertiserId: string, id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id, advertiserId },
    });

    if (!client) {
      throw new ResourceNotFoundException('Client', id);
    }

    return client;
  }

  findAll() {
    return `This action returns all client`;
  }

  async update(advertiserId: string, id: string, updateClientDto: UpdateClientDto) {
    // First check if client exists
    const existingClient = await this.findOne(advertiserId, id);

    if (!existingClient) {
      throw new ResourceNotFoundException('Client', id);
    }

    // Prepare an object to track which fields are being checked for uniqueness
    const uniqueChecks = {
      mobile: false,
      companyGSTIN: false,
      PAN: false,
      CIN: false,
    };

    // Check for other unique fields if they're being updated
    const uniqueFieldChecks: any = [];

    if (updateClientDto.mobile && updateClientDto.mobile !== existingClient.mobile) {
      uniqueChecks.mobile = true;
      uniqueFieldChecks.push({ mobile: updateClientDto.mobile });
    }

    if (updateClientDto.companyGSTIN && updateClientDto.companyGSTIN !== existingClient.companyGSTIN) {
      uniqueChecks.companyGSTIN = true;
      uniqueFieldChecks.push({ companyGSTIN: updateClientDto.companyGSTIN });
    }

    if (updateClientDto.PAN && updateClientDto.PAN !== existingClient.PAN) {
      uniqueChecks.PAN = true;
      uniqueFieldChecks.push({ PAN: updateClientDto.PAN });
    }

    if (updateClientDto.CIN && updateClientDto.CIN !== existingClient.CIN) {
      uniqueChecks.CIN = true;
      uniqueFieldChecks.push({ CIN: updateClientDto.CIN });
    }

    console.log(uniqueFieldChecks);


    if (uniqueFieldChecks.length > 0) {
      const existingFields = await this.prisma.client.findFirst({
        where: {
          id: { not: id }, // Exclude the current client
          OR: uniqueFieldChecks,
        },
      });

      if (existingFields) {
        if (uniqueChecks.mobile && existingFields.mobile === updateClientDto.mobile) {
          throw new ResourceNotFoundException(`Client with this mobile number ${updateClientDto.mobile} already exists.`);
        }
        if (uniqueChecks.companyGSTIN && existingFields.companyGSTIN === updateClientDto.companyGSTIN) {
          throw new ResourceNotFoundException(`Client with this company GSTIN ${updateClientDto.companyGSTIN} already exists.`);
        }
        if (uniqueChecks.PAN && existingFields.PAN === updateClientDto.PAN) {
          throw new ResourceNotFoundException(`Client with this company PAN ${updateClientDto.PAN} already exists.`);
        }
        if (uniqueChecks.CIN && existingFields.CIN === updateClientDto.CIN) {
          throw new ResourceNotFoundException(`Client with this company CIN ${updateClientDto.CIN} already exists.`);
        }
      }
    }

    // Perform the update
    let client = await this.prisma.client.update({
      where: { id },
      data: updateClientDto,
    });

    return {
      message: 'Client updated successfully.',
      client,
    };
  }

  // async remove(advertiserId: string, id: string) {
  //   // First check if client exists
  //   const client = await this.findOne(advertiserId, id);

  //   try {
  //     // Check for dependencies before deletion
  //     // This is a simplified example - you would need to update this based on your actual data model

  //     // Check for active campaigns
  //     const activeCampaigns = await this.prisma.campaign?.findFirst({
  //       where: {
  //         clientId: id,
  //         status: 'ACTIVE',
  //       },
  //     });

  //     if (activeCampaigns) {
  //       throw new ConflictException(
  //         'Cannot delete client with active campaigns. Please deactivate all campaigns first.',
  //       );
  //     }

  //     // Check for unpaid invoices
  //     const unpaidInvoices = await this.prisma.invoice?.findFirst({
  //       where: {
  //         clientId: id,
  //         status: 'UNPAID',
  //       },
  //     });

  //     if (unpaidInvoices) {
  //       throw new ConflictException(
  //         'Cannot delete client with unpaid invoices. Please clear all outstanding payments first.',
  //       );
  //     }

  //     // Perform soft delete or hard delete based on your requirements
  //     // Option 1: Hard delete (completely removes the record)
  //     await this.prisma.client.delete({
  //       where: { id },
  //     });

  //     // Option 2: Soft delete (if you have an isDeleted field in your schema)
  //     // This keeps the record but marks it as deleted
  //     /* 
  //     await this.prisma.client.update({
  //       where: { id },
  //       data: { 
  //         isDeleted: true,
  //         deletedAt: new Date(),
  //       },
  //     });
  //     */

  //     return { message: 'Client deleted successfully' };
  //   } catch (error) {
  //     // Handle specific Prisma errors
  //     if (error.code === 'P2003') {
  //       throw new ConflictException(
  //         'Cannot delete client because it is referenced by other records. ' +
  //         'Please remove all associated data first.',
  //       );
  //     }

  //     // Re-throw other errors for the global exception filter to handle
  //     throw error;
  //   }
  // }
}
