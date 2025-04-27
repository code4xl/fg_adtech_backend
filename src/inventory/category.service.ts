import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { 
  ResourceNotFoundException, 
  DuplicateResourceException 
} from '../common/exceptions/custom.exception';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    // Check if category with same name already exists
    const existingCategory = await this.prisma.contentCategory.findFirst({
      where: {
        name: {
          equals: createCategoryDto.name,
          mode: 'insensitive'
        }
      }
    });

    if (existingCategory) {
      throw new DuplicateResourceException(
        'Content Category',
        'name',
        createCategoryDto.name
      );
    }

    // If parentId is provided, verify parent exists
    if (createCategoryDto.parentId) {
      const parentExists = await this.prisma.contentCategory.findUnique({
        where: { id: createCategoryDto.parentId }
      });

      if (!parentExists) {
        throw new ResourceNotFoundException('Parent Category', createCategoryDto.parentId);
      }
    }

    return this.prisma.contentCategory.create({
      data: createCategoryDto
    });
  }
  async findAll(query?: { parentId?: string; search?: string }) {
    const where: any = {};
    
    if (query?.parentId) {
      where.parentId = query.parentId;
    }
    
    if (query?.search) {
      where.name = {
        contains: query.search,
        mode: 'insensitive'
      };
    }
  
    return this.prisma.contentCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        parentCategory: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            childCategories: true,
            inventories: true
          }
        }
      }
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.contentCategory.findUnique({
      where: { id },
      include: {
        parentCategory: {
          select: {
            id: true,
            name: true
          }
        },
        childCategories: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  
    if (!category) {
      throw new ResourceNotFoundException('Content Category', id);
    }
  
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    // Check if category exists
    await this.findOne(id);

    // Check for name duplication if name is being updated
    if (updateCategoryDto.name) {
      const existingCategory = await this.prisma.contentCategory.findFirst({
        where: {
          name: {
            equals: updateCategoryDto.name,
            mode: 'insensitive'
          },
          id: { not: id }
        }
      });

      if (existingCategory) {
        throw new DuplicateResourceException(
          'Content Category',
          'name',
          updateCategoryDto.name
        );
      }
    }

    // If changing parent, verify new parent exists and prevent circular references
    if (updateCategoryDto.parentId) {
      // Cannot set parent to self
      if (updateCategoryDto.parentId === id) {
        throw new Error('Category cannot be its own parent');
      }

      const parentExists = await this.prisma.contentCategory.findUnique({
        where: { id: updateCategoryDto.parentId }
      });

      if (!parentExists) {
        throw new ResourceNotFoundException('Parent Category', updateCategoryDto.parentId);
      }

      // Check if new parent is one of the category's descendants (prevent circular reference)
      const isCircular = await this.isDescendant(id, updateCategoryDto.parentId);
      if (isCircular) {
        throw new Error('Cannot set a descendant category as parent (circular reference)');
      }
    }

    return this.prisma.contentCategory.update({
      where: { id },
      data: updateCategoryDto
    });
  }

  async remove(id: string) {
    // Check if category exists
    await this.findOne(id);

    // Check if category has children - adjust this based on your schema
    const childrenCount = await this.prisma.contentCategory.count({
      where: { parentId: id }
    });

    if (childrenCount > 0) {
      throw new Error('Cannot delete category with subcategories. Remove subcategories first.');
    }

    // Check if category is used by any inventory
    const inventoryCount = await this.prisma.inventoryCategory.count({
      where: { categoryId: id }
    });

    if (inventoryCount > 0) {
      throw new Error('Cannot delete category that is used by inventory items. Remove category from inventory first.');
    }

    return this.prisma.contentCategory.delete({
      where: { id }
    });
  }

  // Assign a category to an inventory
  async assignToInventory(inventoryId: string, categoryId: string) {
    // Verify category exists
    await this.findOne(categoryId);

    // Check if the assignment already exists
    const existingAssignment = await this.prisma.inventoryCategory.findFirst({
      where: {
        inventoryId,
        categoryId
      }
    });

    if (existingAssignment) {
      return existingAssignment;
    }

    return this.prisma.inventoryCategory.create({
      data: {
        inventoryId,
        categoryId
      }
    });
  }

  // Remove a category from an inventory
  async removeFromInventory(inventoryId: string, categoryId: string) {
    const assignment = await this.prisma.inventoryCategory.findFirst({
      where: {
        inventoryId,
        categoryId
      }
    });

    if (!assignment) {
      throw new ResourceNotFoundException('Category assignment', `${inventoryId}:${categoryId}`);
    }

    // Fix this based on your actual schema
    // If your inventoryCategory has a composite primary key
    return this.prisma.inventoryCategory.delete({
      where: {
        // Adjust this based on your schema's actual unique identifier
        inventoryId_categoryId: {
          inventoryId,
          categoryId
        }
      }
    });
  }

  // Get all categories assigned to an inventory
  async getInventoryCategories(inventoryId: string) {
    return this.prisma.inventoryCategory.findMany({
      where: { inventoryId },
      include: {
        category: true
      }
    });
  }

  // Helper method to check if a category is a descendant of another
  private async isDescendant(ancestorId: string, possibleDescendantId: string): Promise<boolean> {
    // Base case: if they're the same, it's a circular reference
    if (ancestorId === possibleDescendantId) {
      return true;
    }
  
    // Get the possible descendant's parent
    const possibleDescendant = await this.prisma.contentCategory.findUnique({
      where: { id: possibleDescendantId },
      select: { parentId: true }
    });
  
    // If it has no parent, it's not a descendant
    if (!possibleDescendant || !possibleDescendant.parentId) {
      return false;
    }
  
    // Recursively check if the parent is a descendant of the ancestor
    return this.isDescendant(ancestorId, possibleDescendant.parentId);
  }
}