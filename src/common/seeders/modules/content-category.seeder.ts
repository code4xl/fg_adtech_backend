// import { Injectable, Logger } from '@nestjs/common';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { ISeeder } from '../interfaces/seeder.interface';

// @Injectable()
// export class ContentCategorySeeder implements ISeeder {
//   private readonly logger = new Logger(ContentCategorySeeder.name);

//   constructor(private readonly prisma: PrismaService) {}

//   getModuleName(): string {
//     return 'ContentCategory';
//   }

//   getDependencies(): string[] {
//     // No dependencies
//     return [];
//   }

//   async seed(): Promise<void> {
//     this.logger.log('Seeding content categories...');

//     try {
//       // Define parent categories
//       const parentCategories = [
//         { name: 'Technology', description: 'Technology related content' },
//         {
//           name: 'Lifestyle',
//           description: 'Content about lifestyle and wellness',
//         },
//         { name: 'Business', description: 'Business and financial content' },
//         {
//           name: 'Entertainment',
//           description: 'Entertainment and media content',
//         },
//         { name: 'Sports', description: 'Sports-related content' },
//         { name: 'Health', description: 'Health and medical content' },
//         { name: 'Education', description: 'Educational content and resources' },
//         { name: 'Travel', description: 'Travel-related content and guides' },
//       ];

//       // Create parent categories
//       for (const category of parentCategories) {
//         await this.prisma.contentCategory.create({
//           data: {
//             name: category.name,
//             description: category.description,
//           },
//         });
//       }

//       // Define child categories with their parent
//       const childCategories = [
//         // Technology subcategories
//         {
//           name: 'Software Development',
//           parentName: 'Technology',
//           description: 'Content about programming and software development',
//         },
//         {
//           name: 'Hardware',
//           parentName: 'Technology',
//           description: 'Computer hardware and electronics',
//         },
//         {
//           name: 'AI & Machine Learning',
//           parentName: 'Technology',
//           description: 'Artificial intelligence and machine learning content',
//         },
//         {
//           name: 'Mobile',
//           parentName: 'Technology',
//           description: 'Mobile technology and apps',
//         },

//         // Lifestyle subcategories
//         {
//           name: 'Fashion',
//           parentName: 'Lifestyle',
//           description: 'Fashion trends and style',
//         },
//         {
//           name: 'Food & Cooking',
//           parentName: 'Lifestyle',
//           description: 'Recipes and cooking guides',
//         },
//         {
//           name: 'Home & Garden',
//           parentName: 'Lifestyle',
//           description: 'Home improvement and gardening',
//         },

//         // Business subcategories
//         {
//           name: 'Finance',
//           parentName: 'Business',
//           description: 'Financial news and advice',
//         },
//         {
//           name: 'Marketing',
//           parentName: 'Business',
//           description: 'Marketing strategies and news',
//         },
//         {
//           name: 'Entrepreneurship',
//           parentName: 'Business',
//           description: 'Content for startups and entrepreneurs',
//         },

//         // Entertainment subcategories
//         {
//           name: 'Movies',
//           parentName: 'Entertainment',
//           description: 'Movie reviews and news',
//         },
//         {
//           name: 'Music',
//           parentName: 'Entertainment',
//           description: 'Music content and news',
//         },
//         {
//           name: 'Gaming',
//           parentName: 'Entertainment',
//           description: 'Video game content and reviews',
//         },

//         // Sports subcategories
//         {
//           name: 'Football',
//           parentName: 'Sports',
//           description: 'Football news and content',
//         },
//         {
//           name: 'Cricket',
//           parentName: 'Sports',
//           description: 'Cricket news and content',
//         },
//         {
//           name: 'Basketball',
//           parentName: 'Sports',
//           description: 'Basketball news and content',
//         },

//         // Health subcategories
//         {
//           name: 'Fitness',
//           parentName: 'Health',
//           description: 'Exercise and fitness content',
//         },
//         {
//           name: 'Nutrition',
//           parentName: 'Health',
//           description: 'Nutrition and diet information',
//         },
//         {
//           name: 'Mental Health',
//           parentName: 'Health',
//           description: 'Mental health resources and articles',
//         },

//         // Education subcategories
//         {
//           name: 'Higher Education',
//           parentName: 'Education',
//           description: 'University and college resources',
//         },
//         {
//           name: 'Professional Development',
//           parentName: 'Education',
//           description: 'Career development content',
//         },

//         // Travel subcategories
//         {
//           name: 'International',
//           parentName: 'Travel',
//           description: 'International travel content',
//         },
//         {
//           name: 'Adventure',
//           parentName: 'Travel',
//           description: 'Adventure travel content',
//         },
//         {
//           name: 'Budget Travel',
//           parentName: 'Travel',
//           description: 'Budget-friendly travel tips',
//         },
//       ];

//       // Create child categories with parent references
//       for (const child of childCategories) {
//         const parentCategory = await this.prisma.contentCategory.findFirst({
//           where: { name: child.parentName },
//         });

//         if (parentCategory) {
//           await this.prisma.contentCategory.create({
//             data: {
//               name: child.name,
//               description: child.description,
//               parentId: parentCategory.id,
//             },
//           });
//         } else {
//           this.logger.warn(
//             `Parent category ${child.parentName} not found for ${child.name}`,
//           );
//         }
//       }

//       const categoryCount = await this.prisma.contentCategory.count();
//       this.logger.log(
//         `Successfully seeded ${categoryCount} content categories`,
//       );
//     } catch (error) {
//       this.logger.error('Error seeding content categories');
//       this.logger.error(error);
//       throw error;
//     }
//   }

//   async clean(): Promise<void> {
//     this.logger.log('Cleaning content categories table...');

//     try {
//       const deleted = await this.prisma.contentCategory.deleteMany({});
//       this.logger.log(`Deleted ${deleted.count} content categories`);
//     } catch (error) {
//       this.logger.error('Error cleaning content categories table');
//       this.logger.error(error);
//       throw error;
//     }
//   }

//   async isSeeded(): Promise<boolean> {
//     const count = await this.prisma.contentCategory.count();
//     return count > 0;
//   }
// }
