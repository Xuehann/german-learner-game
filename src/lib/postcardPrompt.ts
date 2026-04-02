import { CITY_THEME_META, getThemeFacts } from '../data/germanCities';
import type { CityProfile, CityTheme } from '../types';

interface BuildPostcardPromptOptions {
  city: CityProfile;
  theme: CityTheme;
  readingLevel: string;
}

export const buildPostcardPrompt = ({ city, theme, readingLevel }: BuildPostcardPromptOptions): string => {
  const themeMeta = CITY_THEME_META[theme];
  const themeFacts = getThemeFacts(city, theme);
  const factLines = themeFacts.facts.map((fact, index) => `${index + 1}. ${fact}`).join('\n');
  const keywordLine = themeFacts.keywords.join(', ');

  return [
    'You write postcard-style German reading passages for beginner learners.',
    'Return strict JSON with keys: title, caption, germanText, englishText.',
    `Reading level: ${readingLevel}.`,
    `Target city: ${city.nameDe} (${city.nameEn}) in ${city.countryRegion}.`,
    `Theme: ${themeMeta.label}.`,
    'Requirements:',
    '- Write 4 to 6 short German sentences in simple A1-A2 German.',
    '- The content must be about the target city only.',
    '- Use at least 3 concrete local facts from the provided fact list.',
    '- Do not mention other cities or generic Germany-wide statements unless tied to this city.',
    '- Keep the tone warm and postcard-like, but fact-grounded.',
    '- englishText must be a faithful full translation of germanText.',
    '- caption should be a short postcard subtitle, no more than 18 words.',
    `City summary: ${city.summary}`,
    `Theme keywords: ${keywordLine}`,
    'Approved local facts:',
    factLines
  ].join('\n');
};
