'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Brain, Languages, Plus, Search } from 'lucide-react';
import { translateWord } from '../src/services/geminiService';
import { FlashcardCard } from './components/FlashcardCard';
import type { Flashcard } from '../src/types/flashcard';

const QUIZ_LENGTH = 10;
const QUIZ_QUEUE_STORAGE_KEY = 'linguacard-quiz-queue';

type ViewMode = 'cards' | 'quiz';

function shuffleArray<T>(items: T[]) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
}

function areArraysEqual(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((item, index) => item === second[index]);
}

function readStoredQueue() {
  if (typeof window === 'undefined') {
    return [] as string[];
  }

  try {
    const rawValue = window.localStorage.getItem(QUIZ_QUEUE_STORAGE_KEY);

    if (!rawValue) {
      return [] as string[];
    }

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [] as string[];
  }
}

function writeStoredQueue(queueIds: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(QUIZ_QUEUE_STORAGE_KEY, JSON.stringify(queueIds));
}

function reconcileQueue(cards: Flashcard[], savedQueueIds: string[]) {
  const currentIds = cards.map((card) => card.id);
  const currentIdSet = new Set(currentIds);
  const validSavedIds = savedQueueIds.filter((id) => currentIdSet.has(id));
  const savedIdSet = new Set(validSavedIds);
  const newIds = currentIds.filter((id) => !savedIdSet.has(id));

  return [...validSavedIds, ...newIds];
}

function buildQuestionOptions(currentCard: Flashcard, cards: Flashcard[]) {
  const wrongOptions = shuffleArray(
    Array.from(
      new Set(
        cards
          .filter((card) => card.id !== currentCard.id)
          .map((card) => card.translatedText)
          .filter((translatedText) => translatedText !== currentCard.translatedText)
      )
    )
  ).slice(0, 3);

  return shuffleArray([currentCard.translatedText, ...wrongOptions]);
}

function reorderQueueAfterQuiz(queueIds: string[], quizCardIds: string[], mistakeCardIds: string[]) {
  const quizIdSet = new Set(quizCardIds);
  const mistakeIdSet = new Set(mistakeCardIds.filter((id) => quizIdSet.has(id)));
  const mistakenQuizIds = quizCardIds.filter((id) => mistakeIdSet.has(id));
  const cleanQuizIds = quizCardIds.filter((id) => !mistakeIdSet.has(id));
  const untouchedIds = queueIds.filter((id) => !quizIdSet.has(id));

  return [...mistakenQuizIds, ...untouchedIds, ...cleanQuizIds];
}

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [inputWord, setInputWord] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [filter, setFilter] = useState('');
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [isQueueReady, setIsQueueReady] = useState(false);
  const [quizCardIds, setQuizCardIds] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionOptions, setQuestionOptions] = useState<string[]>([]);
  const [attemptedWrongOptions, setAttemptedWrongOptions] = useState<string[]>([]);
  const [hasAnsweredCurrentQuestion, setHasAnsweredCurrentQuestion] = useState(false);
  const [mistakeCardIds, setMistakeCardIds] = useState<string[]>([]);
  const [hasFinishedQuiz, setHasFinishedQuiz] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCards();
  }, []);

  useEffect(() => {
    const nextQueueIds = reconcileQueue(cards, readStoredQueue());
    writeStoredQueue(nextQueueIds);

    setQueueIds((previousQueueIds) => (
      areArraysEqual(previousQueueIds, nextQueueIds) ? previousQueueIds : nextQueueIds
    ));
    setIsQueueReady(true);
  }, [cards]);

  useEffect(() => {
    const validIdSet = new Set(cards.map((card) => card.id));

    setQuizCardIds((previousQuizIds) => previousQuizIds.filter((id) => validIdSet.has(id)));
    setMistakeCardIds((previousMistakeIds) => previousMistakeIds.filter((id) => validIdSet.has(id)));
  }, [cards]);

  useEffect(() => {
    if (quizCardIds.length === 0) {
      setCurrentQuestionIndex(0);
      return;
    }

    if (currentQuestionIndex > quizCardIds.length - 1) {
      setCurrentQuestionIndex(quizCardIds.length - 1);
    }
  }, [currentQuestionIndex, quizCardIds.length]);

  const currentCard = quizCardIds.length > 0
    ? cards.find((card) => card.id === quizCardIds[currentQuestionIndex]) ?? null
    : null;
  const isQuizActive = quizCardIds.length > 0;
  const isQuizFinished = isQuizActive && hasFinishedQuiz;
  const studiedCardsCount = quizCardIds.length;

  useEffect(() => {
    if (!currentCard || isQuizFinished) {
      setQuestionOptions([]);
      setAttemptedWrongOptions([]);
      setHasAnsweredCurrentQuestion(false);
      return;
    }

    setQuestionOptions(buildQuestionOptions(currentCard, cards));
    setAttemptedWrongOptions([]);
    setHasAnsweredCurrentQuestion(false);
  }, [cards, currentCard, isQuizFinished]);

  const fetchCards = async () => {
    try {
      const response = await fetch('/api/cards');

      if (response.ok) {
        const data = await response.json();
        setCards(data);
      }
    } catch (error) {
      console.error('Failed to load cards', error);
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
      const translation = await translateWord(inputWord);
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: inputWord.trim(),
          ...translation,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar no banco');
      }

      const newCard = await response.json();
      setCards((previousCards) => [newCard, ...previousCards]);
      setInputWord('');
      inputRef.current?.focus();
    } catch (error) {
      console.error(error);
      alert('Erro ao processar. Verifique sua conexão e chave de API.');
    } finally {
      setIsTranslating(false);
    }
  };

  const toggleFlip = async (id: string, currentFlipped: boolean) => {
    setCards((previousCards) => previousCards.map((card) => (
      card.id === id ? { ...card, isFlipped: !currentFlipped } : card
    )));

    try {
      await fetch(`/api/cards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFlipped: !currentFlipped }),
      });
    } catch (error) {
      console.error('Failed to sync flip state', error);
    }
  };

  const deleteCard = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();

    setCards((previousCards) => previousCards.filter((card) => card.id !== id));

    try {
      await fetch(`/api/cards/${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete from server', error);
    }
  };

  const startQuiz = () => {
    if (!isQueueReady || queueIds.length === 0) {
      return;
    }

    const nextQuizIds = queueIds.slice(0, Math.min(QUIZ_LENGTH, queueIds.length));

    setViewMode('quiz');
    setQuizCardIds(nextQuizIds);
    setCurrentQuestionIndex(0);
    setMistakeCardIds([]);
    setAttemptedWrongOptions([]);
    setHasAnsweredCurrentQuestion(false);
    setHasFinishedQuiz(false);
  };

  const handleQuizAnswer = (option: string) => {
    if (!currentCard || hasAnsweredCurrentQuestion || attemptedWrongOptions.includes(option)) {
      return;
    }

    if (option === currentCard.translatedText) {
      setHasAnsweredCurrentQuestion(true);
      return;
    }

    setAttemptedWrongOptions((previousOptions) => [...previousOptions, option]);
    setMistakeCardIds((previousMistakeIds) => (
      previousMistakeIds.includes(currentCard.id)
        ? previousMistakeIds
        : [...previousMistakeIds, currentCard.id]
    ));
  };

  const finishQuiz = () => {
    const nextQueueIds = reorderQueueAfterQuiz(queueIds, quizCardIds, mistakeCardIds);

    setQueueIds(nextQueueIds);
    writeStoredQueue(nextQueueIds);
    setQuestionOptions([]);
    setAttemptedWrongOptions([]);
    setHasAnsweredCurrentQuestion(false);
    setHasFinishedQuiz(true);
  };

  const goToNextQuestion = () => {
    if (!hasAnsweredCurrentQuestion) {
      return;
    }

    if (currentQuestionIndex >= quizCardIds.length - 1) {
      finishQuiz();
      return;
    }

    setCurrentQuestionIndex((previousIndex) => previousIndex + 1);
  };

  const leaveQuiz = () => {
    setViewMode('cards');
    setQuizCardIds([]);
    setCurrentQuestionIndex(0);
    setQuestionOptions([]);
    setAttemptedWrongOptions([]);
    setHasAnsweredCurrentQuestion(false);
    setMistakeCardIds([]);
    setHasFinishedQuiz(false);
  };

  const filteredCards = cards.filter((card) => (
    card.word.toLowerCase().includes(filter.toLowerCase())
      || card.translatedText.toLowerCase().includes(filter.toLowerCase())
  ));

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2 text-white">LinguaCard</h1>
            <p className="text-[#999] max-w-xl">
              Monte seu banco de palavras e pratique com um quiz de 10 perguntas usando uma fila salva no navegador.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white text-black'
                  : 'border border-[#2A2A2A] bg-[#151515] text-[#B5B5B5] hover:border-[#404040] hover:text-white'
              }`}
            >
              Banco de palavras
            </button>
            <button
              type="button"
              onClick={startQuiz}
              disabled={!isQueueReady || queueIds.length === 0}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                !isQueueReady || queueIds.length === 0
                  ? 'cursor-not-allowed bg-[#151515] text-[#555]'
                  : viewMode === 'quiz' && isQuizActive
                    ? 'bg-white text-black'
                    : 'border border-[#2A2A2A] bg-[#151515] text-[#B5B5B5] hover:border-[#404040] hover:text-white'
              }`}
            >
              Iniciar quiz
            </button>
          </div>
        </header>

        {viewMode === 'cards' && (
          <>
            <div className="mb-4 flex justify-end">
              <div className="relative group">
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
                <div className="flex gap-2 rounded-2xl border border-[#222] bg-[#151515] p-2 shadow-xl">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Adicione palavra em ingles..."
                    value={inputWord}
                    onChange={(event) => setInputWord(event.target.value)}
                    className="flex-1 bg-transparent px-4 py-3 text-lg text-white placeholder:text-[#444] focus:outline-none"
                    disabled={isTranslating}
                  />
                  <button
                    type="submit"
                    disabled={!inputWord.trim() || isTranslating}
                    className={`flex items-center justify-center gap-2 rounded-xl px-6 font-medium transition-all ${
                      isTranslating
                        ? 'bg-[#222] text-[#555]'
                        : 'bg-white text-black hover:bg-[#E5E5E5] active:scale-95'
                    }`}
                  >
                    {isTranslating ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    ) : (
                      <>
                        <Plus className="h-5 w-5" />
                        Adicionar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
              <div className="mt-20 rounded-3xl border border-dashed border-[#222] bg-[#121212] py-20 text-center">
                <Languages className="mx-auto mb-4 h-12 w-12 text-[#222]" />
                <p className="font-medium text-[#666]">Sua lista de flashcards esta vazia.</p>
                <p className="mt-1 text-sm text-[#444]">Digite uma palavra acima para comecar.</p>
              </div>
            )}
          </>
        )}

        {viewMode === 'quiz' && (
          <section className="rounded-[2rem] border border-[#222] bg-[#111] p-6 md:p-8">
            {!isQuizActive && (
              <div className="py-14 text-center">
                <Brain className="mx-auto mb-4 h-12 w-12 text-[#2E2E2E]" />
                <p className="text-lg font-medium text-white">Nenhuma rodada em andamento.</p>
                <p className="mt-2 text-sm text-[#777]">
                  Inicie um quiz para consumir os 10 primeiros cards da fila atual.
                </p>
              </div>
            )}

            {isQuizActive && !isQuizFinished && currentCard && (
              <div className="space-y-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-[#666]">Quiz</p>
                    <h2 className="mt-2 text-3xl font-bold text-white">{currentCard.word}</h2>
                    {currentCard.pronunciation && (
                      <p className="mt-2 text-sm italic text-[#8A8A8A]">/{currentCard.pronunciation}/</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[#222] bg-[#151515] px-4 py-3 text-sm text-[#D8D8D8]">
                    Questao {currentQuestionIndex + 1} de {studiedCardsCount}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {questionOptions.map((option) => {
                    const isWrongAttempt = attemptedWrongOptions.includes(option);
                    const isCorrectSelection = hasAnsweredCurrentQuestion && option === currentCard.translatedText;

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleQuizAnswer(option)}
                        disabled={hasAnsweredCurrentQuestion || isWrongAttempt}
                        className={`rounded-2xl border px-5 py-4 text-left text-sm transition-colors ${
                          isCorrectSelection
                            ? 'border-emerald-500 bg-emerald-950/40 text-emerald-100'
                            : isWrongAttempt
                              ? 'border-red-500 bg-red-950/40 text-red-100'
                              : 'border-[#2A2A2A] bg-[#151515] text-[#E8E8E8] hover:border-[#454545] hover:bg-[#1A1A1A]'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-[#222] bg-[#151515] p-4 text-sm text-[#A7A7A7]">
                  {hasAnsweredCurrentQuestion
                    ? 'Resposta correta. Avance para a proxima questao.'
                    : attemptedWrongOptions.length > 0
                      ? 'Opcao errada marcada em vermelho. Tente novamente sem repetir a questao nesta partida.'
                      : 'Escolha a traducao correta em portugues.'}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={goToNextQuestion}
                    disabled={!hasAnsweredCurrentQuestion}
                    className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                      hasAnsweredCurrentQuestion
                        ? 'bg-white text-black hover:bg-[#E5E5E5]'
                        : 'cursor-not-allowed bg-[#1C1C1C] text-[#555]'
                    }`}
                  >
                    {currentQuestionIndex === studiedCardsCount - 1 ? 'Finalizar rodada' : 'Proxima'}
                  </button>
                  <button
                    type="button"
                    onClick={leaveQuiz}
                    className="rounded-full border border-[#2A2A2A] bg-transparent px-5 py-2 text-sm font-medium text-[#B5B5B5] transition-colors hover:border-[#454545] hover:text-white"
                  >
                    Sair do quiz
                  </button>
                </div>
              </div>
            )}

            {isQuizFinished && (
              <div className="space-y-6 py-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#666]">Rodada concluida</p>
                  <h2 className="mt-2 text-3xl font-bold text-white">Quiz encerrado</h2>
                  <p className="mt-3 max-w-2xl text-sm text-[#A0A0A0]">
                    Cards com erro voltaram para o topo da fila da proxima partida. Os cards sem erro foram enviados para o final.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-[#222] bg-[#151515] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#666]">Questoes</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{studiedCardsCount}</p>
                  </div>
                  <div className="rounded-2xl border border-[#222] bg-[#151515] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#666]">Com erro</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{mistakeCardIds.length}</p>
                  </div>
                  <div className="rounded-2xl border border-[#222] bg-[#151515] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#666]">Fila pronta</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{queueIds.length}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={startQuiz}
                    disabled={queueIds.length === 0}
                    className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                      queueIds.length === 0
                        ? 'cursor-not-allowed bg-[#1C1C1C] text-[#555]'
                        : 'bg-white text-black hover:bg-[#E5E5E5]'
                    }`}
                  >
                    Iniciar nova rodada
                  </button>
                  <button
                    type="button"
                    onClick={leaveQuiz}
                    className="rounded-full border border-[#2A2A2A] bg-transparent px-5 py-2 text-sm font-medium text-[#B5B5B5] transition-colors hover:border-[#454545] hover:text-white"
                  >
                    Voltar ao banco
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
