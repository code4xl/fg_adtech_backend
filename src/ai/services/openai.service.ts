// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { HttpService } from '@nestjs/axios';
// import { firstValueFrom } from 'rxjs';
// import {
//   ServiceUnavailableException,
//   BadRequestException
// } from '../../common/exceptions/custom.exception';
// import { WithRetry } from '../../common/resilience/retry.decorator';
// import { AICompletionRequest, AICompletionResponse, AIModel } from '../interfaces/ai-response.interface';

// @Injectable()
// export class OpenAIService {
//   private readonly logger = new Logger(OpenAIService.name);
//   private readonly apiKey: string;
//   private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
//   private readonly defaultModel = AIModel.GPT35_TURBO;
//   private readonly maxRetries = 3;

//   constructor(
//     private readonly configService: ConfigService,
//     private readonly httpService: HttpService
//   ) {
//     this.apiKey = this.configService.get<string>('openai.apiKey') || '';
//     if (!this.apiKey) {
//       this.logger.warn('OpenAI API key not configured');
//     }
//   }

//   @WithRetry(3, 1000, 2)
//   async generateCompletion(request: AICompletionRequest): Promise<AICompletionResponse> {
//     if (!this.apiKey) {
//       throw new ServiceUnavailableException('AI service is not configured');
//     }

//     try {
//       const response = await firstValueFrom(
//         this.httpService.post(
//           this.apiUrl,
//           {
//             model: request.model || this.defaultModel,
//             messages: request.messages,
//             temperature: request.temperature || 0.7,
//             max_tokens: request.maxTokens || 2000,
//             response_format: request.responseFormat
//           },
//           {
//             headers: {
//               'Authorization': `Bearer ${this.apiKey}`,
//               'Content-Type': 'application/json'
//             }
//           }
//         )
//       );

//       const completion = response.data.choices[0];

//       return {
//         content: completion.message.content,
//         usage: {
//           promptTokens: response.data.usage.prompt_tokens,
//           completionTokens: response.data.usage.completion_tokens,
//           totalTokens: response.data.usage.total_tokens
//         },
//         model: response.data.model,
//         finishReason: completion.finish_reason
//       };
//     } catch (error) {
//       this.handleOpenAIError(error);
//     }
//   }

//   async generateStructuredResponse<T>(
//     systemPrompt: string,
//     userPrompt: string,
//     model: AIModel = this.defaultModel
//   ): Promise<T> {
//     const request: AICompletionRequest = {
//       model,
//       messages: [
//         { role: 'system', content: systemPrompt },
//         { role: 'user', content: userPrompt }
//       ],
//       responseFormat: { type: 'json_object' }
//     };

//     const response = await this.generateCompletion(request);

//     try {
//       return JSON.parse(response.content) as T;
//     } catch (error) {
//       this.logger.error('Failed to parse AI response as JSON', error);
//       throw new BadRequestException('Invalid AI response format');
//     }
//   }

//   private handleOpenAIError(error: any): never {
//     if (error.response) {
//       const status = error.response.status;
//       const message = error.response.data?.error?.message || 'OpenAI API error';

//       switch (status) {
//         case 400:
//           throw new BadRequestException(`Invalid request: ${message}`);
//         case 401:
//           throw new ServiceUnavailableException('Invalid API key');
//         case 429:
//           throw new ServiceUnavailableException('Rate limit exceeded. Please try again later');
//         case 500:
//         case 502:
//         case 503:
//           throw new ServiceUnavailableException('AI service temporarily unavailable');
//         default:
//           throw new ServiceUnavailableException(`AI service error: ${message}`);
//       }
//     } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
//       throw new ServiceUnavailableException('Unable to connect to AI service');
//     }

//     throw new ServiceUnavailableException('Unexpected AI service error');
//   }

//   isConfigured(): boolean {
//     return !!this.apiKey;
//   }
// }
