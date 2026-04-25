'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'motion/react';
import { Languages, Plus, Search } from 'lucide-react';
import { FlashcardCard } from './components/FlashcardCard';
import type { Flashcard } from '../src/types/flashcard';

const PAGE_SIZE = 10;

type CardsResponse = {
  items: Flashcard[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export default function Home() {
  const [visibleCards, setVisibleCards] = useState<Flashcard[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMoreCards, setIsLoadingMoreCards] = useState(false);
  const [hasMoreCards, setHasMoreCards] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [inputWord, setInputWord] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const hasHydratedCardsRef = useRef(false);
  const isFetchingCardsRef = useRef(false);
  const cardsAbortControllerRef = useRef<AbortController | null>(null);
  const latestCardsRequestRef = useRef(0);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    const debounceTimeout = window.setTimeout(() => {
      setDebouncedFilter(filter.trim());
    }, 300);

    return () => window.clearTimeout(debounceTimeout);
  }, [filter]);

  useEffect(() => {
    if (!hasHydratedCardsRef.current) {
      return;
    }

    void loadCardsPage(1, debouncedFilter, false);
  }, [debouncedFilter]);

  const fetchCards = async (page: number, search: string, signal?: AbortSignal) => {
    const searchParams = new URLSearchParams();
    searchParams.set('page', page.toString());
    searchParams.set('limit', PAGE_SIZE.toString());

    if (search) {
      searchParams.set('search', search);
    }

    const response = await fetch(`/api/cards?${searchParams.toString()}`, {
      signal,
    });

    if (!response.ok) {
      throw new Error('Erro ao buscar cards');
    }

    return response.json() as Promise<CardsResponse>;
  };

  const loadCardsPage = async (page: number, search: string, append: boolean) => {
    if (append && isFetchingCardsRef.current) {
      return;
    }

    const requestId = latestCardsRequestRef.current + 1;
    latestCardsRequestRef.current = requestId;
    const abortController = new AbortController();

    if (!append) {
      cardsAbortControllerRef.current?.abort();
      cardsAbortControllerRef.current = abortController;
    }

    isFetchingCardsRef.current = true;

    if (append) {
      setIsLoadingMoreCards(true);
    }

    try {
      const data = await fetchCards(page, search, abortController.signal);

      if (latestCardsRequestRef.current !== requestId) {
        return;
      }

      setVisibleCards((previousCards) => (
        append ? [...previousCards, ...data.items] : data.items
      ));
      setCurrentPage(data.page);
      setHasMoreCards(data.hasMore);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      console.error('Failed to load cards', error);

      if (!append) {
        setVisibleCards([]);
        setHasMoreCards(false);
        setCurrentPage(1);
      }
    } finally {
      if (!append && cardsAbortControllerRef.current === abortController) {
        cardsAbortControllerRef.current = null;
      }

      if (latestCardsRequestRef.current === requestId) {
        isFetchingCardsRef.current = false;
        setIsLoadingMoreCards(false);
      }
    }
  };

  const loadInitialData = async () => {
    try {
      const cardsData = await fetchCards(1, '');

      setVisibleCards(cardsData.items);
      setHasMoreCards(cardsData.hasMore);
      setCurrentPage(cardsData.page);
      hasHydratedCardsRef.current = true;
    } catch (error) {
      console.error('Failed to load initial data', error);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleAddCard = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    if (!inputWord.trim() || isTranslating) {
      return;
    }

    setIsTranslating(true);

    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: inputWord.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        if (response.status === 409) {
          alert(errorData?.error ?? 'Ja existe um card com essa word');
          return;
        }

        throw new Error(errorData?.error ?? 'Erro ao salvar no banco');
      }

      await loadCardsPage(1, debouncedFilter, false);
      setInputWord('');
      inputRef.current?.focus();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Erro ao processar. Verifique sua conexão e chave de API.');
    } finally {
      setIsTranslating(false);
    }
  };

  const toggleFlip = async (id: string, currentFlipped: boolean) => {
    const nextFlippedState = !currentFlipped;

    setVisibleCards((previousCards) => previousCards.map((card) => (
      card.id === id ? { ...card, isFlipped: nextFlippedState } : card
    )));

    try {
      await fetch(`/api/cards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFlipped: nextFlippedState }),
      });
    } catch (error) {
      console.error('Failed to sync flip state', error);
    }
  };

  const deleteCard = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();

    setVisibleCards((previousCards) => previousCards.filter((card) => card.id !== id));

    try {
      const response = await fetch(`/api/cards/${id}`, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error('Erro ao excluir card');
      }

      await loadCardsPage(1, debouncedFilter, false);
    } catch (error) {
      console.error('Failed to delete from server', error);
    }
  };

  useEffect(() => {
    if (!hasMoreCards || isLoadingMoreCards) {
      return;
    }

    const node = loadMoreRef.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry?.isIntersecting || isFetchingCardsRef.current) {
          return;
        }

        void loadCardsPage(currentPage + 1, debouncedFilter, true);
      },
      {
        rootMargin: '200px 0px',
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [currentPage, debouncedFilter, hasMoreCards, isLoadingMoreCards]);

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] p-4 font-sans text-[#F5F5F5] md:p-8">
        <div className="mx-auto max-w-5xl animate-pulse">
          <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <div className="h-10 w-56 rounded-xl bg-[#181818]" />
              <div className="h-4 w-full max-w-xl rounded-full bg-[#151515]" />
              <div className="h-4 w-80 rounded-full bg-[#151515]" />
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="h-10 w-32 rounded-full bg-[#151515]" />
            </div>
          </header>

          <div className="mb-4 flex justify-end">
            <div className="h-10 w-64 rounded-full bg-[#151515]" />
          </div>

          <div className="mb-12 rounded-2xl border border-[#222] bg-[#151515] p-2 shadow-xl">
            <div className="flex items-center gap-2">
              <div className="h-12 flex-1 rounded-xl bg-[#101010]" />
              <div className="h-12 w-32 rounded-xl bg-[#E5E5E5]/10" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-64 rounded-3xl border border-[#222] bg-[#151515] p-8"
              >
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <div className="mb-6 h-3 w-20 rounded-full bg-[#242424]" />
                    <div className="h-8 w-3/4 rounded-xl bg-[#1C1C1C]" />
                    <div className="mt-4 h-4 w-1/2 rounded-full bg-[#181818]" />
                  </div>

                  <div className="h-3 w-24 rounded-full bg-[#181818]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-4 font-sans text-[#F5F5F5] md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight text-white">LinguaCard</h1>
            <p className="max-w-xl text-[#999]">
              Monte seu banco de palavras e pratique com um quiz de 10 perguntas usando uma fila salva no banco.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/quiz"
              className="rounded-full border border-[#2A2A2A] bg-[#151515] px-4 py-2 text-sm font-medium text-[#B5B5B5] transition-colors hover:border-[#404040] hover:text-white"
            >
              Iniciar quiz
            </Link>
          </div>
        </header>

        <div className="mb-4 flex justify-end">
          <div className="group relative">
            <Search className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A4A4A] transition-colors group-focus-within:text-[#BDBDBD]" />
            <input
              type="text"
              placeholder="Buscar palavra..."
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="w-64 border-0 border-b border-[#222] bg-transparent px-0 py-2 pl-7 text-sm text-white transition-all placeholder:text-[#555] focus:border-[#555] focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-12">
          <form onSubmit={handleAddCard}>
            <div className="flex items-center gap-2 rounded-2xl border border-[#222] bg-[#151515] p-2 shadow-xl">
              <input
                ref={inputRef}
                type="text"
                placeholder="Adicione palavra em ingles..."
                value={inputWord}
                onChange={(event) => setInputWord(event.target.value)}
                className="min-w-0 flex-1 bg-transparent px-4 py-3 text-lg text-white placeholder:text-[#444] focus:outline-none"
                disabled={isTranslating}
              />
              <button
                type="submit"
                disabled={!inputWord.trim() || isTranslating}
                className={`flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-6 font-medium transition-all ${
                  isTranslating
                    ? 'bg-[#222] text-[#555]'
                    : 'bg-white text-black hover:bg-[#E5E5E5] active:scale-95'
                }`}
              >
                {isTranslating ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                ) : (
                  <>
                    <Plus className="h-12 w-5" />
                    Adicionar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visibleCards.map((card) => (
              <FlashcardCard
                key={card.id}
                card={card}
                onToggleFlip={toggleFlip}
                onDelete={deleteCard}
              />
            ))}
          </AnimatePresence>
        </div>

        <div ref={loadMoreRef} className="mt-8 flex min-h-10 items-center justify-center">
          {isLoadingMoreCards && (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          )}
        </div>

        {visibleCards.length === 0 && !isTranslating && (
          <div className="mt-20 rounded-3xl border border-dashed border-[#222] bg-[#121212] py-20 text-center">
            <Languages className="mx-auto mb-4 h-12 w-12 text-[#222]" />
            <p className="font-medium text-[#666]">
              {debouncedFilter ? 'Nenhum card encontrado para essa busca.' : 'Sua lista de flashcards esta vazia.'}
            </p>
            <p className="mt-1 text-sm text-[#444]">
              {debouncedFilter ? 'Tente buscar outro termo.' : 'Digite uma palavra acima para comecar.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
