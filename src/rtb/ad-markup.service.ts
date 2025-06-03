// import { Injectable, Logger } from '@nestjs/common';
// import { CreativeType } from '@prisma/client';

// @Injectable()
// export class AdMarkupService {
//   private readonly logger = new Logger(AdMarkupService.name);

//   /**
//    * Generate HTML markup for a creative
//    */
//   generateAdMarkup(creative: any, trackingParams: any = {}): string {
//     try {
//       switch (creative.type) {
//         case CreativeType.IMAGE:
//           return this.generateImageAdMarkup(creative, trackingParams);
//         case CreativeType.HTML:
//         case CreativeType.HTML5:
//           return this.generateHtmlAdMarkup(creative, trackingParams);
//         case CreativeType.VIDEO:
//           return this.generateVideoAdMarkup(creative, trackingParams);
//         case CreativeType.RICH_MEDIA:
//           return this.generateRichMediaAdMarkup(creative, trackingParams);
//         default:
//           return this.generateImageAdMarkup(creative, trackingParams);
//       }
//     } catch (error) {
//       this.logger.error(
//         `Error generating ad markup: ${error.message}`,
//         error.stack,
//       );
//       return this.generateFallbackAdMarkup(creative, trackingParams);
//     }
//   }

//   /**
//    * Generate markup for image ads
//    */
//   private generateImageAdMarkup(creative: any, trackingParams: any): string {
//     const { id, width, height, fileUrl, landingUrl, name } = creative;
//     const clickTrackingUrl = this.getClickTrackingUrl(
//       id,
//       landingUrl,
//       trackingParams,
//     );
//     const impressionTrackingUrl = this.getImpressionTrackingUrl(
//       id,
//       trackingParams,
//     );

//     return `
//       <div class="ocean-ad" data-creative-id="${id}" data-creative-type="image" style="width:${width}px;height:${height}px;position:relative;overflow:hidden;">
//         <a href="${clickTrackingUrl}" target="_blank">
//           <img src="${fileUrl}" width="${width}" height="${height}" alt="${name || 'Advertisement'}" style="display:block;width:100%;height:100%;" />
//         </a>
//         <img src="${impressionTrackingUrl}" style="position:absolute;width:1px;height:1px;top:-1px;left:-1px;visibility:hidden;" alt="" />
//       </div>
//     `;
//   }

//   /**
//    * Generate markup for HTML ads
//    */
//   private generateHtmlAdMarkup(creative: any, trackingParams: any): string {
//     const { id, width, height, fileUrl, landingUrl } = creative;
//     const impressionTrackingUrl = this.getImpressionTrackingUrl(
//       id,
//       trackingParams,
//     );

//     // For HTML creatives, we embed in an iframe for security and isolation
//     return `
//       <div class="ocean-ad" data-creative-id="${id}" data-creative-type="html" style="width:${width}px;height:${height}px;position:relative;overflow:hidden;">
//         <iframe
//           src="${fileUrl}"
//           width="${width}"
//           height="${height}"
//           frameborder="0"
//           scrolling="no"
//           marginwidth="0"
//           marginheight="0"
//           sandbox="allow-scripts allow-same-origin allow-popups"
//         ></iframe>
//         <img src="${impressionTrackingUrl}" style="position:absolute;width:1px;height:1px;top:-1px;left:-1px;visibility:hidden;" alt="" />
//       </div>
//     `;
//   }

//   /**
//    * Generate markup for video ads
//    */
//   private generateVideoAdMarkup(creative: any, trackingParams: any): string {
//     const { id, width, height, fileUrl, landingUrl, name } = creative;
//     const clickTrackingUrl = this.getClickTrackingUrl(
//       id,
//       landingUrl,
//       trackingParams,
//     );
//     const impressionTrackingUrl = this.getImpressionTrackingUrl(
//       id,
//       trackingParams,
//     );

//     return `
//       <div class="ocean-ad" data-creative-id="${id}" data-creative-type="video" style="width:${width}px;height:${height}px;position:relative;overflow:hidden;">
//         <video width="${width}" height="${height}" controls autoplay muted playsinline>
//           <source src="${fileUrl}" type="video/mp4">
//           Your browser does not support the video tag.
//         </video>
//         <a href="${clickTrackingUrl}" target="_blank" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;"></a>
//         <img src="${impressionTrackingUrl}" style="position:absolute;width:1px;height:1px;top:-1px;left:-1px;visibility:hidden;" alt="" />
//       </div>
//     `;
//   }

//   /**
//    * Generate markup for rich media ads
//    */
//   private generateRichMediaAdMarkup(
//     creative: any,
//     trackingParams: any,
//   ): string {
//     // Rich media is similar to HTML but may need additional scripts
//     return this.generateHtmlAdMarkup(creative, trackingParams);
//   }

//   /**
//    * Generate fallback ad markup in case of errors
//    */
//   private generateFallbackAdMarkup(creative: any, trackingParams: any): string {
//     const width = creative?.width || 300;
//     const height = creative?.height || 250;
//     const id = creative?.id || 'fallback';

//     return `
//       <div class="ocean-ad" data-creative-id="${id}" data-creative-type="fallback" style="width:${width}px;height:${height}px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#666;">
//         <span>Advertisement</span>
//       </div>
//     `;
//   }

//   /**
//    * Generate URL for click tracking
//    */
//   private getClickTrackingUrl(
//     creativeId: string,
//     landingUrl: string,
//     params: any = {},
//   ): string {
//     const timestamp = Date.now();
//     const encodedLandingUrl = encodeURIComponent(landingUrl);
//     const queryParams = new URLSearchParams({
//       redirect: encodedLandingUrl,
//       t: timestamp.toString(),
//       ...params,
//     }).toString();

//     return `/track/click/${creativeId}?${queryParams}`;
//   }

//   /**
//    * Generate URL for impression tracking
//    */
//   private getImpressionTrackingUrl(
//     creativeId: string,
//     params: any = {},
//   ): string {
//     const timestamp = Date.now();
//     const queryParams = new URLSearchParams({
//       t: timestamp.toString(),
//       ...params,
//     }).toString();

//     return `/track/impression/${creativeId}?${queryParams}`;
//   }
// }
