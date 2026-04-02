import type { CityProfile, CityTheme, CityThemeFacts } from '../types';

export const CITY_THEME_META: Record<
  CityTheme,
  {
    label: string;
    icon: string;
    accent: string;
  }
> = {
  culture: { label: '德国文化', icon: '🎭', accent: '#d46f2d' },
  architecture: { label: '建筑', icon: '🏛️', accent: '#8d5fd3' },
  landmarks: { label: '景点', icon: '📍', accent: '#2f8f72' },
  food: { label: '美食', icon: '🥨', accent: '#c94a57' },
  festivals: { label: '节日', icon: '🎉', accent: '#e0a12f' }
};

const available = (facts: string[], keywords: string[]): CityThemeFacts => ({
  available: true,
  facts,
  keywords
});

const unavailable = (reason: string): CityThemeFacts => ({
  available: false,
  facts: [],
  keywords: [],
  unavailableReason: reason
});

export const GERMAN_CITIES: CityProfile[] = [
  {
    id: 'berlin',
    nameDe: 'Berlin',
    nameEn: 'Berlin',
    countryRegion: 'Nordostdeutschland',
    summary: '柏林适合做城市入门阅读：地标集中、历史层次丰富，文化和节庆主题都很强。',
    imageUrl: '/images/cities/berlin.svg',
    mapPosition: { left: '55%', top: '24%' },
    factsByTheme: {
      culture: available(
        [
          'Berlin is known for Museum Island and its many museums.',
          'The East Side Gallery shows murals on a long section of the former Berlin Wall.',
          'People in Berlin often talk about art, music, and creative neighborhoods like Kreuzberg.'
        ],
        ['Museumsinsel', 'East Side Gallery', 'Kreuzberg']
      ),
      architecture: available(
        [
          'The Brandenburg Gate is one of the best-known monuments in Berlin.',
          'The Reichstag building has a modern glass dome above a historic parliament building.',
          'The Berlin Cathedral stands near Museum Island.'
        ],
        ['Brandenburger Tor', 'Reichstag', 'Berliner Dom']
      ),
      landmarks: available(
        [
          'Visitors often walk from Alexanderplatz to the TV Tower.',
          'The River Spree runs through the city center.',
          'The Memorial to the Murdered Jews of Europe is an important place of remembrance.'
        ],
        ['Alexanderplatz', 'Fernsehturm', 'Spree']
      ),
      food: available(
        [
          'Currywurst is one of Berlin’s best-known street foods.',
          'Many food stalls in Berlin also sell Döner kebab.',
          'People often eat snacks in markets and train stations.'
        ],
        ['Currywurst', 'Döner', 'Streetfood']
      ),
      festivals: available(
        [
          'Berlin hosts the Berlinale film festival every year.',
          'Karneval der Kulturen brings music and parades to the city.',
          'Many Christmas markets appear in winter.'
        ],
        ['Berlinale', 'Karneval der Kulturen', 'Weihnachtsmarkt']
      )
    }
  },
  {
    id: 'hamburg',
    nameDe: 'Hamburg',
    nameEn: 'Hamburg',
    countryRegion: 'Norddeutschland',
    summary: '汉堡的港口、水岸和仓库区辨识度很高，特别适合景点、建筑和美食主题。',
    imageUrl: '/images/cities/hamburg.svg',
    mapPosition: { left: '48%', top: '18%' },
    factsByTheme: {
      culture: available(
        [
          'Hamburg has a strong music and theater scene.',
          'The Elbphilharmonie is both a concert hall and a cultural symbol of the city.',
          'The harbor area shapes everyday life and city identity.'
        ],
        ['Elbphilharmonie', 'Musik', 'Hafenstadt']
      ),
      architecture: available(
        [
          'The Speicherstadt is a historic warehouse district built with red brick.',
          'The Elbphilharmonie stands on top of an old warehouse near the River Elbe.',
          'Many canals and bridges define the cityscape.'
        ],
        ['Speicherstadt', 'Backstein', 'Brücken']
      ),
      landmarks: available(
        [
          'Visitors often take boat tours in the harbor.',
          'The Landungsbrücken are a well-known waterfront stop.',
          'The Alster lakes offer open views and walking paths.'
        ],
        ['Landungsbrücken', 'Alster', 'Hafenrundfahrt']
      ),
      food: available(
        [
          'Fischbrötchen is a typical snack in Hamburg.',
          'Fresh fish dishes are common near the harbor.',
          'The Sunday fish market is a famous local tradition.'
        ],
        ['Fischbrötchen', 'Fischmarkt', 'Frischer Fisch']
      ),
      festivals: available(
        [
          'The Hamburger DOM is a large funfair held several times a year.',
          'The Hafengeburtstag celebrates the harbor with ships and events.',
          'Winter markets also appear around the historic center.'
        ],
        ['Hamburger DOM', 'Hafengeburtstag', 'Jahrmarkt']
      )
    }
  },
  {
    id: 'munich',
    nameDe: 'München',
    nameEn: 'Munich',
    countryRegion: 'Süddeutschland',
    summary: '慕尼黑的城市形象很稳定，啤酒花园、王宫建筑和传统节庆都适合做低门槛阅读。',
    imageUrl: '/images/cities/munich.svg',
    mapPosition: { left: '61%', top: '67%' },
    factsByTheme: {
      culture: available(
        [
          'Munich is known for Bavarian traditions and beer gardens.',
          'People often gather in large open parks like the Englischer Garten.',
          'Traditional clothing such as Dirndl and Lederhosen is visible during festivals.'
        ],
        ['Bayern', 'Englischer Garten', 'Tradition']
      ),
      architecture: available(
        [
          'The Neues Rathaus stands on Marienplatz with a famous clock tower.',
          'The Frauenkirche is one of the best-known churches in Munich.',
          'The Residenz shows the city’s royal history.'
        ],
        ['Marienplatz', 'Neues Rathaus', 'Frauenkirche']
      ),
      landmarks: available(
        [
          'Marienplatz is the busy heart of the city.',
          'The Olympiapark is another popular place to visit.',
          'Visitors often walk from the old town to the Isar River.'
        ],
        ['Marienplatz', 'Olympiapark', 'Isar']
      ),
      food: available(
        [
          'Pretzels, Weißwurst, and sweet mustard are classic Munich foods.',
          'Beer gardens often serve simple Bavarian meals.',
          'People may eat Weißwurst in the morning.'
        ],
        ['Brezel', 'Weißwurst', 'Biergarten']
      ),
      festivals: available(
        [
          'Oktoberfest is the city’s most famous festival.',
          'The festival attracts visitors from many countries.',
          'Traditional music, tents, and Bavarian food are part of the event.'
        ],
        ['Oktoberfest', 'Festzelt', 'Volksfest']
      )
    }
  },
  {
    id: 'cologne',
    nameDe: 'Köln',
    nameEn: 'Cologne',
    countryRegion: 'Westdeutschland',
    summary: '科隆适合做节庆和建筑主题，城市标签非常明确，初学者也容易建立记忆点。',
    imageUrl: '/images/cities/cologne.svg',
    mapPosition: { left: '33%', top: '43%' },
    factsByTheme: {
      culture: available(
        [
          'Cologne has a relaxed local culture along the Rhine.',
          'The city is known for its own beer style called Kölsch.',
          'Local identity is strong and often heard in carnival songs and greetings.'
        ],
        ['Rhein', 'Kölsch', 'Lokalkultur']
      ),
      architecture: available(
        [
          'Cologne Cathedral is one of the most famous Gothic churches in Europe.',
          'The old town has colorful houses near the Rhine.',
          'The Hohenzollern Bridge is known for its many locks and train traffic.'
        ],
        ['Kölner Dom', 'Altstadt', 'Hohenzollernbrücke']
      ),
      landmarks: available(
        [
          'Visitors usually start with Cologne Cathedral near the main station.',
          'The Rhine promenade offers views of bridges and old town streets.',
          'Boat rides on the Rhine are a popular activity.'
        ],
        ['Kölner Dom', 'Rheinpromenade', 'Schifffahrt']
      ),
      food: available(
        [
          'People in Cologne often drink Kölsch in small glasses.',
          'Himmel un Ääd is a traditional regional dish.',
          'Rhenish dishes are common in breweries and taverns.'
        ],
        ['Kölsch', 'Himmel un Ääd', 'Brauhaus']
      ),
      festivals: available(
        [
          'Cologne Carnival is one of the largest carnival celebrations in Germany.',
          'Parades, costumes, and music fill the city before Lent.',
          'Many people greet each other with “Kölle Alaaf”.'
        ],
        ['Karneval', 'Kölle Alaaf', 'Umzug']
      )
    }
  },
  {
    id: 'dresden',
    nameDe: 'Dresden',
    nameEn: 'Dresden',
    countryRegion: 'Ostdeutschland',
    summary: '德累斯顿在巴洛克建筑和圣诞市场上很强，适合建筑、景点和节日主题。',
    imageUrl: '/images/cities/dresden.svg',
    mapPosition: { left: '72%', top: '46%' },
    factsByTheme: {
      culture: available(
        [
          'Dresden is known for classical music and art collections.',
          'The Semperoper is an important opera house in the city.',
          'The city’s old center reflects royal Saxon history.'
        ],
        ['Semperoper', 'Kunstsammlung', 'Sachsen']
      ),
      architecture: available(
        [
          'The Frauenkirche is a major landmark in Dresden.',
          'The Zwinger is a grand Baroque palace complex.',
          'Many visitors notice the city’s restored historic skyline.'
        ],
        ['Frauenkirche', 'Zwinger', 'Barock']
      ),
      landmarks: available(
        [
          'People often walk along the Elbe River in Dresden.',
          'The Brühl Terrace offers wide views over the river.',
          'The historic center gathers many major sights close together.'
        ],
        ['Elbe', 'Brühlsche Terrasse', 'Altstadt']
      ),
      food: available(
        [
          'Eierschecke is a cake associated with Saxony and Dresden.',
          'Cafés in the old town often serve regional pastries.',
          'Local menus can include Saxon potato and meat dishes.'
        ],
        ['Eierschecke', 'Sächsischer Kuchen', 'Café']
      ),
      festivals: available(
        [
          'The Striezelmarkt in Dresden is one of Germany’s oldest Christmas markets.',
          'The market is famous for seasonal lights and festive stalls.',
          'Christmas traditions are important in the city’s winter identity.'
        ],
        ['Striezelmarkt', 'Weihnachtsmarkt', 'Wintertradition']
      )
    }
  },
  {
    id: 'heidelberg',
    nameDe: 'Heidelberg',
    nameEn: 'Heidelberg',
    countryRegion: 'Südwestdeutschland',
    summary: '海德堡适合浪漫、大学城和老城阅读；节庆资料在 v1 先不开放，用来测试主题禁用态。',
    imageUrl: '/images/cities/heidelberg.svg',
    mapPosition: { left: '41%', top: '59%' },
    factsByTheme: {
      culture: available(
        [
          'Heidelberg is famous for its old university and student life.',
          'The city has a long academic tradition.',
          'Many visitors describe Heidelberg as calm and romantic.'
        ],
        ['Universität Heidelberg', 'Studentenstadt', 'Romantik']
      ),
      architecture: available(
        [
          'Heidelberg Castle stands above the old town on the hillside.',
          'The old bridge connects the historic center across the Neckar River.',
          'Baroque buildings shape many streets in the Altstadt.'
        ],
        ['Heidelberger Schloss', 'Alte Brücke', 'Altstadt']
      ),
      landmarks: available(
        [
          'Visitors walk through the old town and up to the castle.',
          'The Neckar River gives the city broad river views.',
          'The Philosophenweg is known for a scenic look back over the city.'
        ],
        ['Neckar', 'Philosophenweg', 'Schlossblick']
      ),
      food: available(
        [
          'Student cafés and bakeries are common in Heidelberg.',
          'People often enjoy cake or coffee in the old town.',
          'Regional Baden dishes can be found in traditional inns.'
        ],
        ['Café', 'Kuchen', 'Badische Küche']
      ),
      festivals: unavailable('海德堡节庆主题在 v1 暂未开放。')
    }
  }
];

export const getCityById = (cityId: string): CityProfile | undefined =>
  GERMAN_CITIES.find((city) => city.id === cityId);

export const getThemeFacts = (city: CityProfile, theme: CityTheme): CityThemeFacts => {
  return city.factsByTheme[theme] ?? unavailable('该主题暂未开放。');
};
