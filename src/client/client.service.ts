import { Injectable } from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { DuplicateResourceException } from 'src/common/exceptions/custom.exception';

@Injectable()
export class ClientService {
  constructor(private readonly prisma: PrismaService) { }
  async create(createClientDto: CreateClientDto) {
    // find unique by email, pan, gstin
    const existingClient = await this.prisma.client.findFirst({
      where: {
        OR: [
          { email: createClientDto.email },
          { pan: createClientDto.pan },
          { gstin: createClientDto.gstin },
        ],
      },
    });

    if (existingClient) {
      throw new DuplicateResourceException(
        'Client with this email, pan or gstin already exists',
        'Client',
        'email, pan or gstin',
      );
    }
    const data = await this.prisma.client.create({
      data: {
        name: createClientDto.name,
        email: createClientDto.email,
        mobile: createClientDto.mobile,
        companyName: createClientDto.companyName,
        hqLocation: createClientDto.hqLocation,
        companySize: createClientDto.companySize,
        registeredAddress: createClientDto.registeredAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
        cin: createClientDto.cin,
        gstin: createClientDto.gstin,
        pan: createClientDto.pan,
        advertiser: {
          connect: {
            id: createClientDto.advertiserId,
          },
        },
      },
    });

    return data;
  }

  findAll() {
    return `This action returns all client`;
  }

  findOne(id: number) {
    return `This action returns a #${id} client`;
  }

  update(id: number, updateClientDto: UpdateClientDto) {
    return `This action updates a #${id} client`;
  }

  remove(id: number) {
    return `This action removes a #${id} client`;
  }
}
