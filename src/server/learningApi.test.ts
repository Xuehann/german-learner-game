import { describe, expect, it } from 'vitest';
import { handleOrderExampleRequest } from './learningApi';

describe('handleOrderExampleRequest', () => {
  it('returns bilingual fallback sentence when OPENAI_API_KEY is missing', async () => {
    const response = await handleOrderExampleRequest(
      JSON.stringify({
        orderType: 'translation',
        correctAnswer: 'der Apfel',
        words: [{ german: 'der Apfel', english: 'apple', category: 'food' }]
      }),
      {
        apiKey: '',
        textModel: 'gpt-4.1-mini',
        pexelsApiKey: ''
      }
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      source: 'fallback'
    });
    const body = response.body as { exampleDe: string; exampleZh: string };
    expect(body.exampleDe.length).toBeGreaterThan(0);
    expect(body.exampleZh.length).toBeGreaterThan(0);
    expect(body.exampleDe.trim().split(/\s+/).length).toBeGreaterThanOrEqual(8);
  });

  it('returns 400 when correctAnswer is missing', async () => {
    const response = await handleOrderExampleRequest(
      JSON.stringify({
        orderType: 'translation',
        words: [{ german: 'der Apfel', english: 'apple', category: 'food' }]
      }),
      {
        apiKey: '',
        textModel: 'gpt-4.1-mini',
        pexelsApiKey: ''
      }
    );

    expect(response.statusCode).toBe(400);
  });
});
