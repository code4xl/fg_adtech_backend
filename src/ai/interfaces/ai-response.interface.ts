export enum AIModel {
    GPT4_TURBO = 'gpt-4-turbo-preview',
    GPT4 = 'gpt-4',
    GPT35_TURBO = 'gpt-3.5-turbo'
  }
  
  export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }
  
  export interface AICompletionRequest {
    model: AIModel;
    messages: AIMessage[];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: 'json_object' | 'text' };
  }
  
  export interface AIUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }
  
  export interface AICompletionResponse {
    content: string;
    usage: AIUsage;
    model: string;
    finishReason: string;
  }
  
  export interface CampaignAISuggestion {
    names: Array<{
      value: string;
      score: number;
      rationale: string;
    }>;
    budget: {
      total: number;
      daily: number;
      strategy: string;
      bidAmount?: number;
    };
    targeting: {
      demographics?: any;
      geo?: any;
      device?: any;
      contextual?: any;
      behavioral?: any;
      time?: any;
      frequencyCap?: any;
    };
    objective: string;
    interests: string[];
    businessCategory: string;
    duration: {
      startDate: string;
      endDate: string;
      days: number;
    };
    metadata: {
      confidence: number;
      processingTime: number;
      model: string;
    };
  }
  
  export interface PerformancePrediction {
    expectedImpressions: number;
    expectedClicks: number;
    expectedCTR: number;
    expectedCPC: number;
    expectedConversions: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
    factors: Array<{
      factor: string;
      impact: 'positive' | 'negative' | 'neutral';
      weight: number;
    }>;
  }