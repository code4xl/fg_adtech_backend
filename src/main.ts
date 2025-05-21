import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import {
  BadRequestException,
  ConsoleLogger,
  ValidationPipe,
} from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import morgan from 'morgan';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SuccessInterceptor } from './common/interceptors/success.interceptor';
import { AllExceptionsFilter } from './common/filters/global.exception';
import { ErrorConfigService } from './common/exceptions/error-config.service';
import { apiReference } from '@scalar/nestjs-api-reference';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({
      json: false,
      colors: true,
      logLevels: ['error', 'warn', 'debug', 'verbose', 'log'],
      prefix: 'OceanAdTech',
    }),
  });
  const configService = app.get(ConfigService);

  // Enable CORS
  app.enableCors();

  // Use Helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ['self'],
          scriptSrc: ['self', 'unsafe-inline', 'cdn.jsdelivr.net'],
          styleSrc: ['self', 'unsafe-inline', 'cdn.jsdelivr.net'],
          imgSrc: ['self', 'data:', 'cdn.jsdelivr.net'],
          connectSrc: [
            'self',
            'https://5x2p27zf-3000.inc1.devtunnels.ms',
            'https://programmatic.api.oceanadnetwork.com',
          ],
        },
      },
    }),
  );

  // Use compression
  app.use(compression());

  // Apply global interceptor for success responses
  app.useGlobalInterceptors(new SuccessInterceptor());

  // Apply global exception filter for error responses
  const errorConfigService = app.get(ErrorConfigService);
  app.useGlobalFilters(new AllExceptionsFilter(errorConfigService));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Swagger API documentation
  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
    app.useGlobalInterceptors(new LoggingInterceptor());

    const config = new DocumentBuilder()
      .setTitle('OceanAdTech API Documentation')
      .setDescription('Documentation for OceanAdTech API')
      .setVersion('1.0')
      .setOpenAPIVersion('3.0.0')
      .addServer('http://localhost:3000', 'Development Server')
      .addServer(
        'https://programmatic.api.oceanadnetwork.com',
        'Production Server',
      )
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      swaggerUiEnabled: true,
      customSiteTitle: 'OceanAdTech API Docs',
      explorer: true,
      jsonDocumentUrl: '/api-json',
      useGlobalPrefix: true,
    });

    app.use(
      '/api',
      apiReference({
        content: document,
        theme: 'bluePlanet',
      }),
    );
  }

  const port = configService.get<number>('port') || 3000;
  await app.listen(port);
}
bootstrap();
