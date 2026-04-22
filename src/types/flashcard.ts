import type { TranslationResult } from '../services/geminiService';

export interface Flashcard extends TranslationResult {
  id: string;
  word: string;
  isFlipped: boolean;
  createdAt: number;
}
