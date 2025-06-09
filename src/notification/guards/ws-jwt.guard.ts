// src/notification/guards/ws-jwt.guard.ts

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const user = client['user'];

      if (!user) {
        throw new WsException('Unauthorized');
      }

      return true;
    } catch (err) {
      throw new WsException(err.message);
    }
  }
}

// Hey, I have completed Phase 1 &2, Now i want to start implementing Phase 3. Can u help me in implementing Phase 3 from my RTB Roadmap. My Current Codebase is provided to u.

// Whatever u do i need reasons and explanations for that. every small thing

// Analyze my current codebase,
