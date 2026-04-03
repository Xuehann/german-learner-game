export interface Word {
  id: string;
  english: string;
  german: string;
  gender?: 'der' | 'die' | 'das';
  plural?: string;
  pastTense?: string;
  category: string;
  pronunciation?: string;
  example?: {
    german: string;
    english: string;
  };
  sourceType?: 'builtin' | 'imported';
}

export interface LearningUnit {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
}

export type UnitWord = Word;

export type CityTheme = 'culture' | 'architecture' | 'landmarks' | 'food' | 'festivals';
export type PostcardImageSource = 'pexels-theme' | 'pexels-city' | 'static-fallback';

export interface CityThemeFacts {
  available: boolean;
  facts: string[];
  keywords: string[];
  unavailableReason?: string;
}

export interface CityProfile {
  id: string;
  nameDe: string;
  nameEn: string;
  countryRegion: string;
  summary: string;
  imageUrl: string;
  mapPosition: {
    left: string;
    top: string;
  };
  factsByTheme: Partial<Record<CityTheme, CityThemeFacts>>;
}

export interface GeneratedPostcard {
  id: string;
  cityId: string;
  theme: CityTheme;
  title: string;
  caption: string;
  germanText: string;
  englishText: string;
  imageUrl: string;
  imageSource?: PostcardImageSource;
  createdAt: string;
  source: 'ai';
}

export interface PostcardAlbumEntry {
  id: string;
  savedAt: string;
  postcard: GeneratedPostcard;
}

export interface ExploreSessionState {
  selectedCityId: string | null;
  selectedTheme: CityTheme | null;
  activePostcard: GeneratedPostcard | null;
}

export interface WordProgress {
  wordId: string;
  attempts: number;
  correct: number;
  lastReviewDate: string;
  nextReviewDate: string;
  masteryLevel: 0 | 1 | 2 | 3;
  averageResponseTime: number;
  errorPatterns: string[];
}

export type OrderType = 'translation' | 'review' | 'combo';
export type CustomerTier = 'regular' | 'rush' | 'collector';

export interface Customer {
  id: string;
  name: string;
  tier: CustomerTier;
  avatar: string;
}

export interface OrderLine {
  wordId: string;
  english: string;
  german: string;
  category: string;
  pastTense?: string;
}

export interface Order {
  id: string;
  type: OrderType;
  customer: Customer;
  lines: OrderLine[];
  prompt: string;
  instruction: string;
}

export interface DayGoal {
  newMasteredTarget: number;
  correctedMistakesTarget: number;
}

export interface DayProgress {
  newMastered: number;
  correctedMistakes: number;
  servedOrders: number;
  correctOrders: number;
}

export interface BusinessDay {
  id: string;
  startedAt: string;
  completedAt?: string;
  goal: DayGoal;
  progress: DayProgress;
  pendingCorrectionWordIds: string[];
  planDayIndex: number;
  planDaysLeft: number;
  planPoolSize: number;
  goalComputedAt: string;
  isCompleted: boolean;
}

export interface SatisfactionState {
  current: number;
  min: number;
  max: number;
}

export interface CoinWallet {
  balance: number;
  earnedToday: number;
  spentToday: number;
}

export type SausageRarity = 'common' | 'rare' | 'epic';

export interface SausageSkin {
  id: string;
  name: string;
  rarity: SausageRarity;
  price: number;
  emoji: string;
  description: string;
}

export interface SausageCollection {
  ownedSkinIds: string[];
  displaySkinId: string | null;
}

export interface GameSession {
  id: string;
  startTime: string;
  endTime?: string;
  gameMode: 'butcher_business';
  dayGoal: DayGoal;
  dayProgress: DayProgress;
  accuracy: number;
  coinsEarned: number;
  isCompleted: boolean;
}

export interface GameAnswer {
  sessionId: string;
  orderId: string;
  orderType: OrderType;
  wordIds: string[];
  userInput: string;
  correctAnswer: string;
  isCorrect: boolean;
  responseTime?: number;
  timestamp: string;
  feedbackType: 'correct' | 'wrong' | 'skip';
}

export type GamePhase =
  | 'intro_door'
  | 'intro_goal'
  | 'serving_order'
  | 'show_order_feedback'
  | 'shop'
  | 'day_summary';

export interface GameFeedback {
  type: 'correct' | 'wrong' | 'skip';
  title: string;
  speech: string;
  correctAnswer: string;
  userInput: string;
  note?: string;
  masteryHint?: string;
  requiresManualContinue?: boolean;
}

export interface GameSettings {
  feedbackDelayMs: number;
  planDays: number;
  planStartDate: string;
  lastIntroDate?: string;
}

export interface ImportValidationError {
  index: number;
  field: string;
  message: string;
}

export interface ImportResult {
  addedWords: number;
  errors: ImportValidationError[];
  message?: string;
}

export interface AIGeneratedUnitDraft {
  suggestedUnitName: string;
  words: Word[];
}

export interface BusinessRuntimeSnapshot {
  businessDay: BusinessDay;
  orderQueue: Order[];
  currentOrder: Order | null;
  satisfaction: SatisfactionState;
  phase?: GamePhase;
  phaseBeforeShop?: GamePhase | null;
}
