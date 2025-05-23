import { PartialType } from '@nestjs/swagger';
import { CreateFloorPriceDto } from './create-floor-price.dto';

export class UpdateFloorPriceDto extends PartialType(CreateFloorPriceDto) {} 