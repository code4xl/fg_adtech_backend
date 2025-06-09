import { PartialType } from '@nestjs/swagger';
import { CreateRtbDto } from './create-rtb.dto';

export class UpdateRtbDto extends PartialType(CreateRtbDto) {}
