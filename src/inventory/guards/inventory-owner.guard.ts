import { 
  Injectable, 
  CanActivate, 
  ExecutionContext 
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  UnauthorizedException, 
  ResourceNotFoundException 
} from '../../common/exceptions/custom.exception';

@Injectable()
export class InventoryOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const inventoryId = request.params.id;
    const publisherId = request.params.publisherId || request.query.publisherId;

    if (!user || !inventoryId) {
      return false;
    }

    // For admin users, we don't need to check ownership - they can access all inventory
    if (user.role === 'admin') {
      // Just check if the inventory exists
      const inventory = await this.prisma.adInventory.findUnique({
        where: { id: inventoryId },
        select: { id: true }
      });

      if (!inventory) {
        throw new ResourceNotFoundException('Inventory', inventoryId);
      }

      return true;
    }

    // For publisher users (legacy support)
    if (user.role === 'publisher') {
      const inventory = await this.prisma.adInventory.findUnique({
        where: { id: inventoryId },
        select: { publisherId: true }
      });

      if (!inventory) {
        throw new ResourceNotFoundException('Inventory', inventoryId);
      }

      // Check if the publisher owns this inventory
      if (inventory.publisherId !== user.id) {
        throw new UnauthorizedException('You do not have permission to access this inventory');
      }

      return true;
    }

    // Any other role is not allowed to access inventory directly
    throw new UnauthorizedException('Only admins or publishers can manage inventory');
  }
}