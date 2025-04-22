import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import dbConfig from './config/db.config';
import dbConfigProduction from './config/db.config.production';

const modules = [
  UsersModule,
]

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [dbConfig, dbConfigProduction],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: process.env.NODE_ENV === "production" ? dbConfigProduction : dbConfig,
    }),
    ...modules,
  ],
})
export class AppModule { }
