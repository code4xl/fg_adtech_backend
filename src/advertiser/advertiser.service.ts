import { Injectable } from '@nestjs/common';
import { CreateAdvertiserDto } from './dto/create-advertiser.dto';
import { UpdateAdvertiserDto } from './dto/update-advertiser.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResourceNotFoundException } from 'src/common/interceptors/custom.interceptor';

@Injectable()
export class AdvertiserService {
  constructor(private readonly prisma: PrismaService) { }

  findAll() {
    return `This action returns all advertiser`;
  }

  async findOne(id: number) {
    let advertiser = await this.prisma.advertiser.findUnique({
      where: {
        id,
      }
    })

    if (!advertiser) {
      throw new ResourceNotFoundException("Advertiser", id);
    }

    return advertiser;
  }

  update(id: number, updateAdvertiserDto: UpdateAdvertiserDto) {
    return `This action updates a #${id} advertiser`;
  }

  remove(id: number) {
    return `This action removes a #${id} advertiser`;
  }
}
