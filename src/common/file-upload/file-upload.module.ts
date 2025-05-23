import { Module, DynamicModule } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FileStorageService } from './file-storage.service';
import { FileValidationService } from './file-validation.service';
import { MulterConfigService } from './multer-config.service';

@Module({
    imports: [
        ConfigModule
    ],
    providers: [
        FileStorageService,
        FileValidationService
    ],
    exports: [FileStorageService, FileValidationService]
})
export class FileUploadModule {
    static register(options?: { destination?: string }): DynamicModule {
        return {
            module: FileUploadModule,
            imports: [
                ConfigModule,
                MulterModule.registerAsync({
                    imports: [ConfigModule],
                    inject: [ConfigService],
                    useFactory: (configService: ConfigService) =>
                        MulterConfigService.createMulterOptions(configService, options?.destination),
                }),
            ],
            providers: [
                FileStorageService,
                FileValidationService
            ],
            exports: [
                MulterModule,
                FileStorageService,
                FileValidationService
            ],
        };
    }
}