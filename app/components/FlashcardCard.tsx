'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Trash2, Volume2, ChevronRight, RotateCcw } from 'lucide-react';
import type { Flashcard } from '../../src/types/flashcard';

interface FlashcardCardProps {
  card: Flashcard;
  onToggleFlip: (id: string, currentFlipped: boolean) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

export function FlashcardCard({ card, onToggleFlip, onDelete }: FlashcardCardProps) {
  return (
    <motion.div
      layout
      key={card.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={() => onToggleFlip(card.id, card.isFlipped)}
      className="group relative cursor-pointer h-64 w-full perspective-1000"
    >
      <div
        className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
          card.isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        <div className="absolute inset-0 backface-hidden bg-[#151515] rounded-3xl p-8 border border-[#222] flex flex-col justify-center items-center shadow-lg hover:shadow-xl transition-all group-hover:border-[#333]">
          <span className="text-[#444] text-xs font-mono mb-4 uppercase tracking-widest">English</span>
          <h2 className="text-3xl font-bold text-center break-words text-white">{card.word}</h2>
          {card.pronunciation && (
            <div className="mt-4 flex items-center gap-2 text-[#666]">
              <Volume2 className="w-4 h-4" />
              <span className="text-sm font-light italic">/{card.pronunciation}/</span>
            </div>
          )}
          <button
            onClick={(e) => onDelete(e, card.id)}
            className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-950/30 text-[#444] hover:text-red-500 rounded-full transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="absolute bottom-4 flex items-center gap-1 text-[#333] text-[10px] font-medium uppercase tracking-tighter">
            Click to flip <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[#1E1E1E] text-[#F2F2F2] rounded-3xl p-8 flex flex-col justify-center items-center overflow-hidden border border-[#2A2A2A]">
          <div className="relative z-10 w-full flex flex-col items-center">
            <span className="text-[#8A8A8A] text-xs font-mono mb-4 uppercase tracking-widest">Português</span>
            <h2 className="text-3xl font-bold text-center mb-6">{card.translatedText}</h2>

            {card.exampleSentence && (
              <div className="w-full space-y-2 pt-6 border-t border-white/10">
                <p className="text-sm text-[#E0E0E0] italic text-center">"{card.exampleSentence}"</p>
                <p className="text-xs text-[#9A9A9A] text-center">{card.exampleTranslation}</p>
              </div>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFlip(card.id, card.isFlipped);
            }}
            className="absolute bottom-4 flex items-center gap-1 text-[#7A7A7A] hover:text-[#CFCFCF] text-[10px] font-medium uppercase tracking-tighter transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> View original
          </button>
        </div>
      </div>
    </motion.div>
  );
}
