'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { Plus, Languages, Search } from 'lucide-react';
import { translateWord } from '../src/services/geminiService';
import { FlashcardCard } from './components/FlashcardCard';
import type { Flashcard } from '../src/types/flashcard';

export default function Home() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [inputWord, setInputWord] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const response = await fetch('/api/cards');
      if (response.ok) {
        const data = await response.json();
        setCards(data);
      }
    } catch (e) {
      console.error("Failed to load cards", e);
    }
  };

  const handleAddCard = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputWord.trim() || isTranslating) return;

    setIsTranslating(true);
    try {
      // 1. Translate via IA
      const translation = await translateWord(inputWord);
      
      // 2. Save to DB
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: inputWord.trim(),
          ...translation,
        }),
      });

      if (response.ok) {
        const newCard = await response.json();
        setCards(prev => [newCard, ...prev]);
        setInputWord('');
        inputRef.current?.focus();
      } else {
        throw new Error("Erro ao salvar no banco");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao processar. Verifique sua conexão e chave de API.");
    } finally {
      setIsTranslating(false);
    }
  };

  const toggleFlip = async (id: string, currentFlipped: boolean) => {
    // Update locally immediately
    setCards(prev => prev.map(card => 
      card.id === id ? { ...card, isFlipped: !currentFlipped } : card
    ));

    // Update in DB
    try {
      await fetch(`/api/cards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFlipped: !currentFlipped }),
      });
    } catch (e) {
      console.error("Failed to sync flip state", e);
    }
  };

  const deleteCard = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    // Remove locally
    setCards(prev => prev.filter(card => card.id !== id));

    // Remove from DB
    try {
      await fetch(`/api/cards/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error("Failed to delete from server", e);
    }
  };

  const filteredCards = cards.filter(card => 
    card.word.toLowerCase().includes(filter.toLowerCase()) ||
    card.translatedText.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2 text-white">LinguaCard</h1>
            <p className="text-[#999] max-w-md">
              Adicione palavras em inglês e deixe a IA cuidar da tradução e pronúncia.
            </p>
          </div>
          
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666] group-focus-within:text-white transition-colors" />
            <input 
              type="text"
              placeholder="Buscar palavra..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-[#151515] border border-[#222] text-white rounded-full px-10 py-2 w-full md:w-64 focus:outline-none focus:border-[#444] transition-all"
            />
          </div>
        </header>

        <form onSubmit={handleAddCard} className="mb-12">
          <div className="flex gap-2 p-2 bg-[#151515] rounded-2xl shadow-xl border border-[#222]">
            <input
              ref={inputRef}
              type="text"
              placeholder="Adicione palavra em Inglês..."
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              className="flex-1 px-4 py-3 bg-transparent text-lg text-white focus:outline-none placeholder:text-[#444]"
              disabled={isTranslating}
            />
            <button
              type="submit"
              disabled={!inputWord.trim() || isTranslating}
              className={`px-6 rounded-xl flex items-center justify-center gap-2 font-medium transition-all ${
                isTranslating 
                ? 'bg-[#222] text-[#555]' 
                : 'bg-white text-black hover:bg-[#E5E5E5] active:scale-95'
              }`}
            >
              {isTranslating ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Adicionar
                </>
              )}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredCards.map((card) => (
              <FlashcardCard
                key={card.id}
                card={card}
                onToggleFlip={toggleFlip}
                onDelete={deleteCard}
              />
            ))}
          </AnimatePresence>
        </div>

        {cards.length === 0 && !isTranslating && (
          <div className="mt-20 text-center py-20 bg-[#121212] rounded-3xl border border-dashed border-[#222]">
            <Languages className="w-12 h-12 text-[#222] mx-auto mb-4" />
            <p className="text-[#666] font-medium">Sua lista de flashcards está vazia.</p>
            <p className="text-sm text-[#444] mt-1">Digite uma palavra acima para começar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
