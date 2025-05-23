import { PartialType } from '@nestjs/swagger';
import { CreateTargetingRuleDto } from './create-targeting-rule.dto';

export class UpdateTargetingRuleDto extends PartialType(CreateTargetingRuleDto) {} 