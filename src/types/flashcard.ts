import type { TranslationResult } from './translation';

export interface Flashcard extends TranslationResult {
  id: string;
  word: string;
  isFlipped: boolean;
  createdAt: number;
}
