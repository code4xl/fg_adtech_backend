import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '../exceptions/custom.exception';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Make role comparison case-insensitive
    const userRole = user?.role?.toUpperCase();
    const expectedRoles = roles.map(role => role.toUpperCase());
    
    if (!user || !expectedRoles.includes(userRole)) {
      throw new UnauthorizedException('You do not have permission to access this resource');
    }
    
    return true;
  }
} 