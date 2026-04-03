import { describe, expect, it } from 'vitest';
import { handleOrderExampleRequest } from './learningApi';

describe('handleOrderExampleRequest', () => {
  it('returns fallback sentence when OPENAI_API_KEY is missing', async () => {
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
    expect((response.body as { example: string }).example.length).toBeGreaterThan(0);
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
