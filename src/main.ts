import { NestFactory, Reflector } from '@nestjs/core';
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
import { RedisIoAdapter } from './redis/adapters/redis-io.adapter';
// import { ApiKeyGuard } from './common/guards/api-key.guard';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({
      json: false,
      colors: true,
      logLevels: ['error', 'warn', 'fatal', 'debug'],
      prefix: 'OceanAdTech',
    }),
  });
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);


  // Apply API Key Guard globally to ALL routes
  // app.useGlobalGuards(new ApiKeyGuard(configService, reflector));

  // Enable CORS with comprehensive configuration
  app.enableCors({


    origin: [
      'http://localhost:3000',
      'https://ec2-13-202-24-106.ap-south-1.compute.amazonaws.com',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://127.0.0.1:5501',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://13.202.24.106',           // Add your EC2 IP
      'http://13.202.24.106:3001',
      'https://ec2-13-202-24-106.ap-south-1.compute.amazonaws.com',
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      '*', // Allow all origins for tracking endpoints
      'null',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'Cache-Control',
      'Pragma',
      'Expires'
    ],
    credentials: false, // Set to true if you need to send cookies
    preflightContinue: false,
    optionsSuccessStatus: 204,
    exposedHeaders: ['Content-Length', 'Content-Type'],
  });

  // Use Helmet for security headers (Development)
  // app.use(
  //   helmet({
  //     contentSecurityPolicy: {
  //       directives: {
  //         defaultSrc: ["'self'"], // Note the quotes around 'self'
  //         scriptSrc: [
  //           "'self'",
  //           "'unsafe-inline'",
  //           'cdn.jsdelivr.net',
  //           'https://ec2-13-202-24-106.ap-south-1.compute.amazonaws.com',
  //           'http://127.0.0.1:3001',
  //           'http://13.202.24.106',
  //           'http://localhost:*',
  //           'http://127.0.0.1:*'
  //         ],
  //         styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
  //         imgSrc: [
  //           "'self'",
  //           'data:',
  //           'cdn.jsdelivr.net',
  //           'https://s3.ap-south-1.amazonaws.com',
  //           'https://bucket.programmatic.oceanadnetwork.s3.ap-south-1.amazonaws.com',
  //           'https://*.s3.amazonaws.com',
  //           'https://*.s3.ap-south-1.amazonaws.com'
  //         ],
  //         connectSrc: [
  //           "'self'",
  //           'https://ec2-13-202-24-106.ap-south-1.compute.amazonaws.com',
  //           'http://127.0.0.1:3001',
  //           'http://13.202.24.106',        // Add this
  //           'http://13.202.24.106:3001',   // Add this
  //           'http://localhost:*',
  //           'http://127.0.0.1:*',
  //           'https://5x2p27zf-3000.inc1.devtunnels.ms',
  //           'https://programmatic.api.oceanadnetwork.com',
  //           'https://ec2-13-202-24-106.ap-south-1.compute.amazonaws.com/track',
  //           'http://127.0.0.1:3001/track',
  //         ],
  //       },
  //     },
  //     crossOriginResourcePolicy: { policy: "cross-origin" },
  //   }),
  // );

  // Production (Atharva)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            'cdn.jsdelivr.net',
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
          imgSrc: [
            "'self'",
            'data:',
            'cdn.jsdelivr.net',
            'https://s3.ap-south-1.amazonaws.com',
            'https://bucket.programmatic.oceanadnetwork.s3.ap-south-1.amazonaws.com',
            'https://*.s3.amazonaws.com',
            'https://*.s3.ap-south-1.amazonaws.com'
          ],
          connectSrc: [
            "'self'",
            'https://ec2-13-202-24-106.ap-south-1.compute.amazonaws.com'
          ],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
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

  app.useStaticAssets(join(process.cwd(), 'cdn-files', 'p'), {
    prefix: '/p/',
  });

  // Create and configure the Redis IO adapter
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();

  // Apply the adapter to the application
  app.useWebSocketAdapter(redisIoAdapter);

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    console.error('Stack:', err.stack);
  });

  // Swagger API documentation
  // if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
  app.useGlobalInterceptors(new LoggingInterceptor());

  const config = new DocumentBuilder()
    .setTitle('OceanAdTech API Documentation')
    .setDescription('Documentation for OceanAdTech API')
    .setVersion('1.0')
    .setOpenAPIVersion('3.0.0')
    .addServer(
      'https://5x2p27zf-3000.inc1.devtunnels.ms/',
      'Development Tunnel',
    )
    .addServer('https://ec2-13-202-24-106.ap-south-1.compute.amazonaws.com', 'Development Server')
    // .addServer(
    // 'https://programmatic.api.oceanadnetwork.com',
    // 'Production Server',
    // )
    // .addServer(
    //   'https://ec2-13-202-24-106.ap-south-1.compute.amazonaws.com', 'Production Server',
    // ).addApiKey(
    //   {
    //     type: 'apiKey',
    //     name: 'X-API-Key',
    //     in: 'header',
    //     description: 'Enter your API Key',
    //   },
    //   'X-API-Key',
    // )
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document, {
    swaggerUiEnabled: true,
    customSiteTitle: 'OceanAdTech API Docs',
    explorer: true,
    jsonDocumentUrl: '/api-json',
    useGlobalPrefix: false,
  });

  // app.use(
  //   '/api',
  //   apiReference({
  //     content: document,
  //     theme: 'bluePlanet',
  //   }),
  // );

  app.use(
    '/api-swagger',
    apiReference({
      content: document,
      theme: 'bluePlanet',
    }),
  );
  // }

  const port = configService.get<number>('port') || 3001;
  await app.listen(port);
}
bootstrap();
