/**
 * Shared LLM client for the ability server.
 * Extracted from skill-core/executor.ts to avoid circular dependencies.
 * OpenAI-compatible DeepSeek API.
 */

import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export function getLLMConfig() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  };
}

export function getLLMClient(): OpenAI {
  const config = getLLMConfig();
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }
  return openaiClient;
}

export function isLLMConfigured(): boolean {
  const key = process.env.DEEPSEEK_API_KEY || '';
  return key.length > 0 && !key.startsWith('your_');
}
