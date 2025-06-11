import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
  } from '@nestjs/common';
  import { PrismaService } from '../../prisma/prisma.service';
  
  /**
   * Guard to ensure publishers can only access their own CDN resources
   * Admins can access all resources
   */
  @Injectable()
  export class CdnAccessGuard implements CanActivate {
    private readonly logger = new Logger(CdnAccessGuard.name);
  
    constructor(private readonly prisma: PrismaService) {}
  
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
      const user = request.user; // Set by AuthenticationGuard
      const publisherId = request.params.publisherId;
      const websiteId = request.params.websiteId;
  
      // If no user, deny access
      if (!user) {
        throw new ForbiddenException('Authentication required');
      }
  
      // Admins can access everything
      if (user.role === 'ADMIN') {
        return true;
      }
  
      // Publishers can only access their own resources
      if (user.role === 'PUBLISHER') {
        // Check if the publisher ID matches
        if (user.publisherId !== publisherId) {
          this.logger.warn(
            `Publisher ${user.publisherId} attempted to access resources of publisher ${publisherId}`,
          );
          throw new ForbiddenException('Access denied to this publisher resource');
        }
  
        // If websiteId is provided, verify it belongs to the publisher
        if (websiteId) {
          const website = await this.prisma.website.findFirst({
            where: {
              id: websiteId,
              publisherId: publisherId,
            },
          });
  
          if (!website) {
            this.logger.warn(
              `Publisher ${publisherId} attempted to access non-existent or unauthorized website ${websiteId}`,
            );
            throw new ForbiddenException('Website not found or access denied');
          }
        }
  
        return true;
      }
  
      // Deny access for any other roles
      throw new ForbiddenException('Insufficient permissions');
    }
  }