import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdSlotTemplateDto } from '../dto/create-adslot-template.dto';
import { UpdateAdSlotTemplateDto } from '../dto/update-adslot-template.dto';
import { AdminQueryDto } from '../dto/admin-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminAdSlotTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateAdSlotTemplateDto) {
    // Check if name already exists
    const existing = await this.prisma.adSlotTemplate.findFirst({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new ConflictException('Ad slot template with this name already exists');
    }

    return this.prisma.adSlotTemplate.create({
      data: createDto,
    });
  }

  async findAll(query: AdminQueryDto) {
    const { page, limit, search, isActive, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AdSlotTemplateWhereInput = {};

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (isActive !== undefined) {
      (where as any).isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.adSlotTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          _count: {
            select: {
              creatives: true,
              adInventories: true,
            },
          },
        },
      }),
      this.prisma.adSlotTemplate.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const template = await this.prisma.adSlotTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            creatives: true,
            adInventories: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Ad slot template not found');
    }

    return template;
  }

  async update(id: string, updateDto: UpdateAdSlotTemplateDto) {
    // Check if template exists
    await this.findOne(id);

    // Check if new name already exists (if name is being updated)
    if (updateDto.name) {
      const existing = await this.prisma.adSlotTemplate.findFirst({
        where: {
          name: updateDto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException('Ad slot template with this name already exists');
      }
    }

    return this.prisma.adSlotTemplate.update({
      where: { id },
      data: updateDto,
      include: {
        _count: {
          select: {
            creatives: true,
            adInventories: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Check if template is in use
    const usage = await this.prisma.adSlotTemplate.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            creatives: true,
            adInventories: true,
          },
        },
      },
    });

    if (usage._count.creatives > 0 || usage._count.adInventories > 0) {
      throw new ConflictException(
        'Cannot delete ad slot template that is in use. Please deactivate it instead.'
      );
    }

    return this.prisma.adSlotTemplate.delete({
      where: { id },
    });
  }

  async toggleStatus(id: string) {
    const template = await this.findOne(id);

    return this.prisma.adSlotTemplate.update({
      where: { id },
      data: {
        isActive: !(template as any).isActive,
      } as any,
      include: {
        _count: {
          select: {
            creatives: true,
            adInventories: true,
          },
        },
      },
    });
  }
}