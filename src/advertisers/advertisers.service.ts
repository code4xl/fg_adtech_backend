import { Injectable } from '@nestjs/common';
import { CreateAdvertiserDto } from './dto/create-advertiser.dto';
import { UpdateAdvertiserDto } from './dto/update-advertiser.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdvertisersService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  create(createAdvertiserDto: CreateAdvertiserDto) {
    // let advertiser = this.prisma.advertiser.create({});

    return 'This action adds a new advertiser';
  }

  findAll() {
    return `This action returns all advertisers`;
  }

  findOne(id: number) {
    return `This action returns a #${id} advertiser`;
  }

  update(id: number, updateAdvertiserDto: UpdateAdvertiserDto) {
    return `This action updates a #${id} advertiser`;
  }

  remove(id: number) {
    return `This action removes a #${id} advertiser`;
  }
}
