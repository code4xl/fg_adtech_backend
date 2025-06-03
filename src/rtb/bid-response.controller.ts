// import {
//   Controller,
//   Get,
//   Param,
//   Query,
//   Res,
//   HttpStatus,
//   Logger,
// } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
// import { Response } from 'express';
// import { BidResponseService } from './bid-response.service';

// @ApiTags('RTB')
// @Controller('bid-response')
// export class BidResponseController {
//   private readonly logger = new Logger(BidResponseController.name);

//   constructor(private readonly bidResponseService: BidResponseService) {}

//   @Get(':requestId')
//   @ApiOperation({ summary: 'Get bid response by request ID' })
//   @ApiParam({ name: 'requestId', description: 'Bid request ID' })
//   @ApiResponse({
//     status: 200,
//     description: 'Bid response retrieved successfully',
//   })
//   @ApiResponse({ status: 404, description: 'Bid request not found' })
//   async getBidResponse(
//     @Param('requestId') requestId: string,
//     @Query('timeout') timeout: number = 200,
//     @Res() res: Response,
//   ) {
//     try {
//       // Set timeout for the response
//       const timeoutPromise = new Promise((resolve) => {
//         setTimeout(() => {
//           resolve({ timeout: true });
//         }, timeout);
//       });

//       // Race between the actual response and timeout
//       const result: any = await Promise.race([
//         this.bidResponseService.getBidResponse(requestId),
//         timeoutPromise,
//       ]);

//       // Handle timeout
//       if (result.timeout) {
//         this.logger.warn(`Timeout for bid response: ${requestId}`);
//         return res
//           .status(HttpStatus.OK)
//           .header('Content-Type', 'text/html')
//           .send(this.generateTimeoutResponse());
//       }

//       // Return HTML content directly
//       return res
//         .status(HttpStatus.OK)
//         .header('Content-Type', 'text/html')
//         .header(
//           'Cache-Control',
//           result.cached ? 'public, max-age=300' : 'no-cache',
//         )
//         .send(result.html);
//     } catch (error) {
//       this.logger.error(
//         `Error getting bid response: ${error.message}`,
//         error.stack,
//       );

//       // Return a fallback ad in case of error
//       return res
//         .status(HttpStatus.OK)
//         .header('Content-Type', 'text/html')
//         .send(this.generateErrorResponse());
//     }
//   }

//   /**
//    * Generate timeout response HTML
//    */
//   private generateTimeoutResponse(): string {
//     return `
//       <div class="ocean-ad ocean-ad-timeout" style="width:300px;height:250px;border:1px solid #eee;display:flex;align-items:center;justify-content:center;background:#f9f9f9;color:#999;font-family:sans-serif;font-size:12px;">
//         <span>Advertisement</span>
//       </div>
//     `;
//   }

//   /**
//    * Generate error response HTML
//    */
//   private generateErrorResponse(): string {
//     return `
//       <div class="ocean-ad ocean-ad-error" style="width:300px;height:250px;border:1px solid #eee;display:flex;align-items:center;justify-content:center;background:#f9f9f9;color:#999;font-family:sans-serif;font-size:12px;">
//         <span>Advertisement</span>
//       </div>
//     `;
//   }
// }
