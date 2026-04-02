import { describe, expect, it } from 'vitest';
import { getCityById } from '../data/germanCities';
import { buildPostcardPrompt } from './postcardPrompt';

describe('buildPostcardPrompt', () => {
  it('injects city-specific facts into the prompt', () => {
    const city = getCityById('berlin');
    expect(city).toBeDefined();

    const prompt = buildPostcardPrompt({
      city: city!,
      theme: 'landmarks',
      readingLevel: 'A1-A2'
    });

    expect(prompt).toContain('Target city: Berlin (Berlin) in Nordostdeutschland.');
    expect(prompt).toContain('Theme: 景点.');
    expect(prompt).toContain('Visitors often walk from Alexanderplatz to the TV Tower.');
    expect(prompt).toContain('Theme keywords: Alexanderplatz, Fernsehturm, Spree');
    expect(prompt).toContain('Use at least 3 concrete local facts from the provided fact list.');
  });
});
