// Create src/timescale/dto/timescale-events.dto.ts
export class TimescaleImpressionDto {
  timestamp: string;
  impression_id: string;
  creative_id: string;
  campaign_id: string;
  advertiser_id: string;
  inventory_id: string;
  publisher_id: string;
  website_id: string;
  price?: number;
  publisher_revenue?: number;
  user_id?: string;
  session_id?: string;
  user_agent?: string;
  ip_address?: string;
  device_type?: string;
  browser_type?: string;
  os_type?: string;
  country?: string;
  region?: string;
  city?: string;
  viewable?: boolean;
  view_time?: number;
  viewable_pixels?: number;
  ad_size_pixels?: string;
}

export class TimescaleClickDto {
  timestamp: string;
  click_id: string;
  impression_id: string;
  creative_id: string;
  campaign_id: string;
  advertiser_id: string;
  // ... other fields
}

export class TimescaleBidMetricDto {
  timestamp: string;
  auction_id: string;
  bid_price: number;
  win_price?: number;
  // ... other fields
}
