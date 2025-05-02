import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePublisherDto } from './dto/create-publisher.dto';
import { UpdatePublisherDto } from './dto/update-publisher.dto';
import { Language, PublisherStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  ResourceNotFoundException,
  DuplicateResourceException,
  BadRequestException
} from '../common/exceptions/custom.exception';

@Injectable()
export class PublisherService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPublisherDto: CreatePublisherDto) {
    // Check if email already exists
    const existingPublisher = await this.prisma.publisher.findUnique({
      where: { email: createPublisherDto.email }
    });

    if (existingPublisher) {
      throw new DuplicateResourceException(
        'Publisher',
        'email',
        createPublisherDto.email
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(createPublisherDto.password, 10);

    // Create publisher
    const publisher = await this.prisma.publisher.create({
      data: {
        firstName: createPublisherDto.firstName,
        lastName: createPublisherDto.lastName,
        email: createPublisherDto.email,
        password: hashedPassword,
        domain: createPublisherDto.domain,
        status: createPublisherDto.status || PublisherStatus.ACTIVE
      }
    });

    // Assign categories if provided
    if (createPublisherDto.categoryIds && createPublisherDto.categoryIds.length > 0) {
      await Promise.all(
        createPublisherDto.categoryIds.map(categoryId =>
          this.assignCategory(publisher.id, categoryId)
        )
      );
    }

    // Assign languages if provided
    if (createPublisherDto.languages && createPublisherDto.languages.length > 0) {
      await Promise.all(
        createPublisherDto.languages.map(language =>
          this.assignLanguage(publisher.id, language)
        )
      );
    }

    // Return publisher with associated data
    return this.findOne(publisher.id);
  }
  async getPublishersByCategoryAndLanguage(categoryId?: string, language?: string) {
    const where: any = {};
    
    // Add category filter if provided
    if (categoryId) {
      where.categories = {
        some: { categoryId }
      };
    }
    
    // Add language filter if provided
    if (language) {
      where.languages = {
        some: { language }
      };
    }
    
    return this.prisma.publisher.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        domain: true,
        status: true
      }
    });
  }
  async findAll(query?: { status?: string; search?: string }) {
    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.search) {
      where.OR = [
        {
          firstName: {
            contains: query.search,
            mode: 'insensitive'
          }
        },
        {
          lastName: {
            contains: query.search,
            mode: 'insensitive'
          }
        },
        {
          email: {
            contains: query.search,
            mode: 'insensitive'
          }
        }
      ];
    }

    return this.prisma.publisher.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        domain: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            inventories: true,
            categories: true,
            languages: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const publisher = await this.prisma.publisher.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            category: true
          }
        },
        languages: true,
        _count: {
          select: {
            inventories: true
          }
        }
      }
    });

    if (!publisher) {
      throw new ResourceNotFoundException('Publisher', id);
    }

    // Don't return the password
    const { password, ...result } = publisher;
    return result;
  }

  async update(id: string, updatePublisherDto: UpdatePublisherDto) {
    // Check if publisher exists
    await this.findOne(id);

    // Check if email is being updated and already exists
    if (updatePublisherDto.email) {
      const existingPublisher = await this.prisma.publisher.findFirst({
        where: {
          email: updatePublisherDto.email,
          id: { not: id }
        }
      });

      if (existingPublisher) {
        throw new DuplicateResourceException(
          'Publisher',
          'email',
          updatePublisherDto.email
        );
      }
    }

    // Hash the password if it's being updated
    let data: any = { ...updatePublisherDto };
    if (updatePublisherDto.password) {
      data.password = await bcrypt.hash(updatePublisherDto.password, 10);
    }

    // Remove categoryIds and languages from data as they're handled separately
    const { categoryIds, languages, ...publisherData } = data;

    // Update publisher basic info
    await this.prisma.publisher.update({
      where: { id },
      data: publisherData
    });

    // Update categories if provided
    if (categoryIds && categoryIds.length > 0) {
      // Get current categories
      const currentCategories = await this.prisma.publisherCategory.findMany({
        where: { publisherId: id },
        select: { categoryId: true }
      });
      
      const currentCategoryIds = currentCategories.map(c => c.categoryId);
      
      // Categories to add
      const categoriesToAdd = categoryIds.filter(
        catId => !currentCategoryIds.includes(catId)
      );
      
      // Categories to remove
      const categoriesToRemove = currentCategoryIds.filter(
        catId => !categoryIds.includes(catId)
      );
      
      // Add new categories
      await Promise.all(
        categoriesToAdd.map(categoryId => 
          this.assignCategory(id, categoryId)
        )
      );
      
      // Remove old categories
      await Promise.all(
        categoriesToRemove.map(categoryId => 
          this.removeCategory(id, categoryId)
        )
      );
    }

    // Update languages if provided
    if (languages && languages.length > 0) {
      // Get current languages
      const currentLanguages = await this.prisma.publisherLanguage.findMany({
        where: { publisherId: id },
        select: { language: true }
      });
      
      const currentLanguageValues = currentLanguages.map(l => l.language);
      
      // Languages to add
      const languagesToAdd = languages.filter(
        lang => !currentLanguageValues.includes(lang as Language)
      );
      
      // Languages to remove
      const languagesToRemove = currentLanguageValues.filter(
        lang => !languages.includes(lang as string)
      );
      
      // Add new languages
      await Promise.all(
        languagesToAdd.map(language => 
          this.assignLanguage(id, language)
        )
      );
      
      // Remove old languages
      await Promise.all(
        languagesToRemove.map(language => 
          this.removeLanguage(id, language as string)
        )
      );
    }

    // Return updated publisher
    return this.findOne(id);
  }

  async remove(id: string) {
    // Check if publisher exists
    await this.findOne(id);

    // Check if publisher has inventory
    const inventoryCount = await this.prisma.adInventory.count({
      where: { publisherId: id }
    });

    if (inventoryCount > 0) {
      throw new BadRequestException(
        'Cannot delete publisher with active inventory. Delete inventory first or deactivate publisher instead.'
      );
    }

    // Delete publisher and all related data (categories, languages)
    return this.prisma.publisher.delete({
      where: { id }
    });
  }

  async getPublisherInventory(publisherId: string) {
    // Verify publisher exists
    await this.findOne(publisherId);

    return this.prisma.adInventory.findMany({
      where: { publisherId },
      include: {
        floorPrices: {
          where: {
            startDate: { lte: new Date() },
            OR: [
              { endDate: { gte: new Date() } },
              { endDate: null }
            ]
          },
          orderBy: { startDate: 'desc' },
          take: 1
        },
        categories: {
          include: {
            category: true
          }
        },
        _count: {
          select: {
            impressions: true
          }
        }
      }
    });
  }

  async getPublisherCategories(publisherId: string) {
    // Verify publisher exists
    await this.findOne(publisherId);

    return this.prisma.publisherCategory.findMany({
      where: { publisherId },
      include: {
        category: true
      }
    });
  }

  async assignCategory(publisherId: string, categoryId: string) {
    // Verify publisher exists
    await this.findOne(publisherId);

    // Verify category exists
    const category = await this.prisma.contentCategory.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      throw new ResourceNotFoundException('Category', categoryId);
    }

    // Check if assignment already exists
    const existingAssignment = await this.prisma.publisherCategory.findFirst({
      where: {
        publisherId,
        categoryId
      }
    });

    if (existingAssignment) {
      return existingAssignment;
    }

    // Create new assignment
    return this.prisma.publisherCategory.create({
      data: {
        publisherId,
        categoryId
      }
    });
  }

  async removeCategory(publisherId: string, categoryId: string) {
    // Verify assignment exists
    const assignment = await this.prisma.publisherCategory.findFirst({
      where: {
        publisherId,
        categoryId
      }
    });

    if (!assignment) {
      throw new ResourceNotFoundException(
        'Category assignment',
        `${publisherId}:${categoryId}`
      );
    }

    // Delete assignment
    return this.prisma.publisherCategory.delete({
      where: {
        publisherId_categoryId: {
          publisherId,
          categoryId
        }
      }
    });
  }

  async getPublisherLanguages(publisherId: string) {
    // Verify publisher exists
    await this.findOne(publisherId);

    return this.prisma.publisherLanguage.findMany({
      where: { publisherId }
    });
  }

  async assignLanguage(publisherId: string, language: string) {
    // Verify publisher exists
    await this.findOne(publisherId);

    // Verify language is valid
    if (!Object.values(Language).includes(language as Language)) {
      throw new BadRequestException(`Invalid language: ${language}`);
    }

    // Check if assignment already exists
    const existingAssignment = await this.prisma.publisherLanguage.findFirst({
      where: {
        publisherId,
        language: language as Language
      }
    });

    if (existingAssignment) {
      return existingAssignment;
    }

    // Create new assignment
    return this.prisma.publisherLanguage.create({
      data: {
        publisherId,
        language: language as Language
      }
    });
  }

  async removeLanguage(publisherId: string, language: string) {
    // Verify language is valid
    if (!Object.values(Language).includes(language as Language)) {
      throw new BadRequestException(`Invalid language: ${language}`);
    }

    // Verify assignment exists
    const assignment = await this.prisma.publisherLanguage.findFirst({
      where: {
        publisherId,
        language: language as Language
      }
    });

    if (!assignment) {
      throw new ResourceNotFoundException(
        'Language assignment',
        `${publisherId}:${language}`
      );
    }

    // Delete assignment
    return this.prisma.publisherLanguage.delete({
      where: {
        publisherId_language: {
          publisherId,
          language: language as Language
        }
      }
    });
  }
}