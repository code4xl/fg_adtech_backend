import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import morgan from 'morgan';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
async function bootstrap() {
   
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger(
      {
        json:false,
        colors:true,
        logLevels: ['error', 'warn', 'debug', 'verbose', 'fatal', 'log'],
        prefix: "OceanAdTech",
      }
    )

  });
  const configService = app.get(ConfigService);
  
  // Enable CORS
  app.enableCors();
  
  // Use Helmet for security headers
  app.use(helmet())
  
  // Use compression
  app.use(compression());

  
  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist: true,
      // forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Swagger API documentation
  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan("dev"))
    app.useGlobalInterceptors(new LoggingInterceptor());
    
    const config = new DocumentBuilder()
      .setTitle('Ocean AdTech API')
      .setDescription('Programmatic AdTech API description')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
      
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }
  
  const port = configService.get<number>('port') || 3000;
  await app.listen(port);
}
bootstrap();