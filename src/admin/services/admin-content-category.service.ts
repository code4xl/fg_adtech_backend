import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContentCategoryDto } from '../dto/create-content-category.dto';
import { UpdateContentCategoryDto } from '../dto/update-content-category.dto';
import { AdminQueryDto } from '../dto/admin-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminContentCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateContentCategoryDto) {
    // Check if name already exists
    const existing = await this.prisma.contentCategory.findUnique({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new ConflictException('Content category with this name already exists');
    }

    return this.prisma.contentCategory.create({
      data: {
        ...createDto,
        isActive: true,
      },
    });
  }

  async findAll(query: AdminQueryDto) {
    const { page, limit, search, isActive, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ContentCategoryWhereInput = {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.contentCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          _count: {
            select: {
              websites: true,
            },
          },
        },
      }),
      this.prisma.contentCategory.count({ where }),
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
    const category = await this.prisma.contentCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            websites: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Content category not found');
    }

    return category;
  }

  async update(id: string, updateDto: UpdateContentCategoryDto) {
    // Check if category exists
    await this.findOne(id);

    // Check if new name already exists (if name is being updated)
    if (updateDto.name) {
      const existing = await this.prisma.contentCategory.findFirst({
        where: {
          name: updateDto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException('Content category with this name already exists');
      }
    }

    return this.prisma.contentCategory.update({
      where: { id },
      data: updateDto,
      include: {
        _count: {
          select: {
            websites: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Check if category is in use
    const usage = await this.prisma.contentCategory.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            websites: true,
          },
        },
      },
    });

    if (usage._count.websites > 0) {
      throw new ConflictException(
        'Cannot delete content category that is in use. Please deactivate it instead.'
      );
    }

    return this.prisma.contentCategory.delete({
      where: { id },
    });
  }

  async toggleStatus(id: string) {
    const category = await this.findOne(id);

    return this.prisma.contentCategory.update({
      where: { id },
      data: {
        isActive: !category.isActive,
      },
      include: {
        _count: {
          select: {
            websites: true,
          },
        },
      },
    });
  }
}