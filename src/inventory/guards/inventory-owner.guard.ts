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
  
      if (!user || !inventoryId) {
        return false;
      }
  
      // Only publishers can manage inventory
      if (user.role !== 'publisher') {
        throw new UnauthorizedException('Only publishers can manage inventory');
      }
  
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
  }