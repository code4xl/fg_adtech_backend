import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImpressionClickLinkingService } from 'src/tracking/services/impression-click-linking.service';

@Injectable()
export class AdMarkupService {
  private readonly logger = new Logger(AdMarkupService.name);
  private readonly trackingBaseUrl: string;
  constructor(
    private readonly configService: ConfigService,
    private readonly impressionClickLinking: ImpressionClickLinkingService,
  ) {
    this.trackingBaseUrl =
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('tracking.baseUrl') ||
      'https://ec2-13-202-24-106.ap-south-1.compute.amazonaws.com';
  }

  public generateTrackingUrls(
    auctionId: string,
    bidResponseId: string,
  ): {
    impression: string[];
    click: string[];
  } {
    const baseUrl = this.trackingBaseUrl;

    const slotId =
      this.impressionClickLinking.generateImpressionSlot(bidResponseId);

      const timestamp = Date.now();

    return {
      impression: [
        `${baseUrl}/api/pixel/${bidResponseId}?slotId=${slotId}&auctionId=${auctionId}&t=${timestamp}`,
      ],
      click: [
        `${baseUrl}/api/redirect/${bidResponseId}?slotId=${slotId}&auctionId=${auctionId}&t=${timestamp}&url=`,
      ],
    };
  }
  public generateAdMarkup(
    creative: any,
    trackingUrls: { impression: string[]; click: string[] },
    context: {
      width: number;
      height: number;
      format?: string;
    },
  ): string {
    const { width, height, format } = context;
    const impressionUrl = trackingUrls.impression[0];
    const clickUrl = trackingUrls.click[0];

    // Determine format from creative or context
    const creativeFormat =
      format || creative.format || 'BANNER';

    // Generate markup based on creative type
    switch (creativeFormat) {
      case 'BANNER':
        return this.generateBannerMarkup(
          creative,
          width,
          height,
          impressionUrl,
          clickUrl,
        );

      case 'NATIVE':
        return this.generateBannerMarkup(
          creative,
          width,
          height,
          impressionUrl,
          clickUrl,
        );
        // return this.generateNativeMarkup(creative, impressionUrl, clickUrl);

      case 'VIDEO':
        return this.generateVideoMarkup(
          creative,
          width,
          height,
          impressionUrl,
          clickUrl,
        );

      default:
        return this.generateDefaultMarkup(
          creative,
          width,
          height,
          impressionUrl,
          clickUrl,
        );
    }
  }

  public generateBannerMarkup(
    creative: any,
    width: number,
    height: number,
    impressionUrl: string,
    clickUrl: string,
  ): string {
    const finalClickUrl = `${clickUrl}${encodeURIComponent(creative.landingUrl || '')}`;
    
    this.logger.debug('Generating banner markup:', {
      creativeId: creative.id,
      fileUrl: creative.fileUrl,
      landingUrl: creative.landingUrl,
      name: creative.name,
      finalClickUrl,
    });
    
    return `
            <div class="ocean-ad-container" style="width: ${width}px; height: ${height}px; position: relative; overflow: hidden;">
                <a href="${finalClickUrl}" target="_blank" style="display: block; width: 100%; height: 100%;">
                    <img src="${creative.fileUrl}" 
                         alt="${creative.name || 'Advertisement'}"
                         style="width: 100%; height: 100%; object-fit: cover;" />
                </a>
                <img src="${impressionUrl}" style="position: absolute; width: 1px; height: 1px; opacity: 0;" alt="" />
            </div>
            `.trim();
  }

  public generateNativeMarkup(
    creative: any,
    impressionUrl: string,
    clickUrl: string,
  ): string {
    const finalClickUrl = `${clickUrl}${encodeURIComponent(creative.landingUrl || '')}`;
    
    return `
            <div class="ocean-native-ad">
                <div class="ocean-native-content">
                    <h3 class="ocean-native-title">${creative.name || 'Advertisement'}</h3>
                    <p class="ocean-native-description">Learn more about ${creative.name || 'this offer'}</p>
                    <a href="${finalClickUrl}" target="_blank" class="ocean-native-cta">
                        Learn More
                    </a>
                </div>
                <img src="${impressionUrl}" style="display: none;" alt="" />
            </div>
            `.trim();
  }

  public generateVideoMarkup(
    creative: any,
    width: number,
    height: number,
    impressionUrl: string,
    clickUrl: string,
  ): string {
    const finalClickUrl = `${clickUrl}${encodeURIComponent(creative.landingUrl || '')}`;
    
    return `
            <div class="ocean-video-ad" style="width: ${width}px; height: ${height}px; position: relative;">
                <video width="${width}" height="${height}" controls autoplay muted>
                    <source src="${creative.fileUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
                <div class="ocean-video-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
                    <a href="${finalClickUrl}" target="_blank" 
                       style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 5px 10px; text-decoration: none; pointer-events: auto;">
                        Learn More
                    </a>
                </div>
                <img src="${impressionUrl}" style="display: none;" alt="" />
            </div>
            `.trim();
  }

  public generateDefaultMarkup(
    creative: any,
    width: number,
    height: number,
    impressionUrl: string,
    clickUrl: string,
  ): string {
    const finalClickUrl = `${clickUrl}${encodeURIComponent(creative.landingUrl || '')}`;
    
    return `
            <div class="ocean-ad" style="width: ${width}px; height: ${height}px;">
                <a href="${finalClickUrl}" target="_blank">
                    <img src="${creative.fileUrl}" 
                         alt="${creative.name || 'Advertisement'}"
                         style="width: 100%; height: 100%;" />
                </a>
                <img src="${impressionUrl}" style="display: none;" alt="" />
            </div>
            `.trim();
  }
}
