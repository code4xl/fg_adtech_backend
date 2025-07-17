import { ApiProperty } from "@nestjs/swagger";
import { ClientCampaignResponseDto } from "./campaign-response.dto";

export class ClientCampaignDetailResponseDto extends ClientCampaignResponseDto {
  @ApiProperty()
  creatives: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    createdAt: Date;
  }>;

  @ApiProperty()
  audienceTargets: Array<{
    id: string;
    name: string;
    targetType: string;
    criteria: any;
    isActive: boolean;
    createdAt: Date;
  }>;

  @ApiProperty()
  assignedBy: string;
}