import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateAdvertiserDto } from './dto/create-advertiser.dto';
import { UpdateAdvertiserDto } from './dto/update-advertiser.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  MovedPermanentlyException,
  ResourceNotFoundException,
  ForbiddenException,
} from 'src/common/exceptions/custom.exception';


import { AdvertiserHelper } from './advertiser.helper';

@Injectable()
export class AdvertiserService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  // ! Advertiser CRUD Operations

  async findAll() {
    return `This action returns all advertiser`;
  }

  async findOne(id: string) {
    return `This action returns specific advertiser`;
  }

  async update(id: number, updateAdvertiserDto: UpdateAdvertiserDto) {
    return `This action updates a #${id} advertiser`;
  }

  async remove(id: number) {
    return `This action removes a #${id} advertiser`;
  }








}