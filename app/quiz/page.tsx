'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Brain } from 'lucide-react';

const QUIZ_LENGTH = 10;

type QuizCard = {
  id: string;
  word: string;
  translatedText: string;
  pronunciation: string | null;
  options: string[];
};

type QuizSessionResponse = {
  cards: QuizCard[];
  totalQueueCount: number;
};

type QuizCompletionResponse = {
  totalQueueCount: number;
};

export default function QuizPage() {
  const [quizCards, setQuizCards] = useState<QuizCard[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [attemptedWrongOptions, setAttemptedWrongOptions] = useState<string[]>([]);
  const [hasAnsweredCurrentQuestion, setHasAnsweredCurrentQuestion] = useState(false);
  const [mistakeCardIds, setMistakeCardIds] = useState<string[]>([]);
  const [hasFinishedQuiz, setHasFinishedQuiz] = useState(false);
  const [isFinishingQuiz, setIsFinishingQuiz] = useState(false);

  useEffect(() => {
    void loadQuizSession();
  }, []);

  const currentCard = quizCards[currentQuestionIndex] ?? null;
  const isQuizActive = quizCards.length > 0;
  const isQuizFinished = isQuizActive && hasFinishedQuiz;
  const studiedCardsCount = quizCards.length;

  const fetchQuizSession = async () => {
    const response = await fetch(`/api/quiz-session?limit=${QUIZ_LENGTH}`);

    if (!response.ok) {
      throw new Error('Erro ao carregar quiz');
    }

    return response.json() as Promise<QuizSessionResponse>;
  };

  const persistQuizResult = async () => {
    const response = await fetch('/api/quiz-session', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizCardIds: quizCards.map((card) => card.id),
        mistakeCardIds,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error ?? 'Erro ao salvar resultado do quiz');
    }

    return response.json() as Promise<QuizCompletionResponse>;
  };

  const loadQuizSession = async () => {
    setIsInitialLoading(true);

    try {
      const session = await fetchQuizSession();

      setQuizCards(session.cards);
      setQueueCount(session.totalQueueCount);
      setCurrentQuestionIndex(0);
      setAttemptedWrongOptions([]);
      setHasAnsweredCurrentQuestion(false);
      setMistakeCardIds([]);
      setHasFinishedQuiz(false);
    } catch (error) {
      console.error('Failed to load quiz session', error);
      setQuizCards([]);
      setQueueCount(0);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleQuizAnswer = (option: string) => {
    if (!currentCard || hasAnsweredCurrentQuestion || attemptedWrongOptions.includes(option) || isFinishingQuiz) {
      return;
    }

    if (option === currentCard.translatedText) {
      setHasAnsweredCurrentQuestion(true);

      if (currentQuestionIndex >= quizCards.length - 1) {
        void finishQuiz();
      } else {
        setAttemptedWrongOptions([]);
        setHasAnsweredCurrentQuestion(false);
        setCurrentQuestionIndex((previousIndex) => previousIndex + 1);
      }

      return;
    }

    setAttemptedWrongOptions((previousOptions) => [...previousOptions, option]);
    setMistakeCardIds((previousMistakeIds) => (
      previousMistakeIds.includes(currentCard.id)
        ? previousMistakeIds
        : [...previousMistakeIds, currentCard.id]
    ));
  };

  const finishQuiz = async () => {
    if (isFinishingQuiz) {
      return;
    }

    setIsFinishingQuiz(true);

    try {
      const result = await persistQuizResult();

      setQueueCount(result.totalQueueCount);
      setAttemptedWrongOptions([]);
      setHasAnsweredCurrentQuestion(false);
      setHasFinishedQuiz(true);
    } catch (error) {
      console.error('Failed to save quiz session', error);
      alert('Erro ao salvar resultado do quiz. Tente novamente.');
    } finally {
      setIsFinishingQuiz(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] p-4 font-sans text-[#F5F5F5] md:p-8">
        <div className="mx-auto max-w-5xl animate-pulse">
          <div className="mb-10 h-10 w-56 rounded-xl bg-[#181818]" />
          <div className="rounded-[2rem] border border-[#222] bg-[#111] p-6 md:p-8">
            <div className="space-y-4">
              <div className="h-8 w-40 rounded-xl bg-[#181818]" />
              <div className="h-28 rounded-2xl bg-[#151515]" />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-16 rounded-2xl bg-[#151515]" />
                <div className="h-16 rounded-2xl bg-[#151515]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-4 font-sans text-[#F5F5F5] md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight text-white">Quiz</h1>
            <p className="max-w-xl text-[#999]">
              A rodada comeca automaticamente com os primeiros cards da fila e salva a nova ordem ao concluir.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex rounded-full border border-[#2A2A2A] bg-[#151515] px-4 py-2 text-sm font-medium text-[#B5B5B5] transition-colors hover:border-[#404040] hover:text-white"
          >
            Voltar ao banco
          </Link>
        </header>

        {!isQuizActive && (
          <section className="rounded-[2rem] border border-[#222] bg-[#111] p-6 md:p-8">
            <div className="py-14 text-center">
              <Brain className="mx-auto mb-4 h-12 w-12 text-[#2E2E2E]" />
              <p className="text-lg font-medium text-white">Nenhum card disponivel na fila.</p>
              <p className="mt-2 text-sm text-[#777]">Adicione cards no banco para montar a proxima rodada.</p>

              <div className="mt-8 flex justify-center gap-3">
                <Link
                  href="/"
                  className="rounded-full border border-[#2A2A2A] bg-transparent px-5 py-2 text-sm font-medium text-[#B5B5B5] transition-colors hover:border-[#454545] hover:text-white"
                >
                  Ir para cards
                </Link>
              </div>
            </div>
          </section>
        )}

        {isQuizActive && !isQuizFinished && currentCard && (
          <section className="rounded-[2rem] border border-[#222] bg-[#111] p-6 md:p-8">
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
                {currentCard.options.map((option) => {
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

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="rounded-full border border-[#2A2A2A] bg-transparent px-5 py-2 text-sm font-medium text-[#B5B5B5] transition-colors hover:border-[#454545] hover:text-white"
                >
                  Voltar ao banco
                </Link>
              </div>
            </div>
          </section>
        )}

        {isQuizFinished && (
          <section className="rounded-[2rem] border border-[#222] bg-[#111] p-6 md:p-8">
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
                  <p className="mt-3 text-3xl font-semibold text-white">{queueCount}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void loadQuizSession()}
                  disabled={isInitialLoading || queueCount === 0}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                    isInitialLoading || queueCount === 0
                      ? 'cursor-not-allowed bg-[#1C1C1C] text-[#555]'
                      : 'bg-white text-black hover:bg-[#E5E5E5]'
                  }`}
                >
                  Iniciar nova rodada
                </button>
                <Link
                  href="/"
                  className="rounded-full border border-[#2A2A2A] bg-transparent px-5 py-2 text-sm font-medium text-[#B5B5B5] transition-colors hover:border-[#454545] hover:text-white"
                >
                  Voltar ao banco
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
