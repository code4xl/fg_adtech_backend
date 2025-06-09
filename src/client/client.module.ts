// import { Module } from '@nestjs/common';
// import { ClientService } from './client.service';
// import { ClientController } from './client.controller';
// import { PrismaModule } from 'src/prisma/prisma.module';
// import { JwtModule } from '@nestjs/jwt';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { ClientGuard } from 'src/common/guards/authorization.guard';

// @Module({
//   imports: [
//     PrismaModule,
//   ],
//   controllers: [ClientController],
//   providers: [ClientService, ClientGuard],
//   exports: [ClientService, ClientGuard],
// })
// export class ClientModule { }