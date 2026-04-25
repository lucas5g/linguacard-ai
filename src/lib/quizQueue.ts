import prisma from '@/src/lib/prisma';

const QUIZ_POSITION_STEP = 1;
const QUIZ_OPTIONS_COUNT = 4;
const QUIZ_OPTIONS_POOL_SIZE = 120;

type QuizSessionCard = {
  id: string;
  word: string;
  translatedText: string;
  pronunciation: string | null;
};

type LegacyQueueRow = {
  flashcardId: string;
};

function shuffleArray<T>(items: T[]) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
}

function buildQuestionOptions(currentCard: QuizSessionCard, optionPool: string[]) {
  const wrongOptions = shuffleArray(
    optionPool.filter((translatedText) => translatedText !== currentCard.translatedText)
  ).slice(0, QUIZ_OPTIONS_COUNT - 1);

  return shuffleArray([currentCard.translatedText, ...wrongOptions]);
}

export async function ensureQuizPositions() {
  const cardsWithoutPosition = await prisma.flashcard.findMany({
    where: { quizPosition: null },
    select: { id: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  if (cardsWithoutPosition.length === 0) {
    return;
  }

  const maxPosition = await prisma.flashcard.aggregate({
    _max: { quizPosition: true },
  });
  const queuedCards = await prisma.$queryRaw<LegacyQueueRow[]>`
    SELECT "flashcardId"
    FROM "QuizQueueItem"
    ORDER BY "position" ASC
  `.catch(() => []);
  const cardsWithoutPositionIds = new Set(cardsWithoutPosition.map((card) => card.id));
  const queuedCardIds = queuedCards
    .map((queueItem) => queueItem.flashcardId)
    .filter((id) => cardsWithoutPositionIds.has(id));
  const queuedCardIdSet = new Set(queuedCardIds);
  const orderedCardIds = [
    ...queuedCardIds,
    ...cardsWithoutPosition
      .map((card) => card.id)
      .filter((id) => !queuedCardIdSet.has(id)),
  ];

  let nextPosition = (maxPosition._max.quizPosition ?? 0) + QUIZ_POSITION_STEP;
  const updates = orderedCardIds.map((id) => {
    const quizPosition = nextPosition;
    nextPosition += QUIZ_POSITION_STEP;

    return prisma.flashcard.update({
      where: { id },
      data: { quizPosition },
    });
  });

  await prisma.$transaction(updates);
}

export async function appendCardToQuizQueue(cardId: string) {
  const maxPosition = await prisma.flashcard.aggregate({
    _max: { quizPosition: true },
  });

  const quizPosition = (maxPosition._max.quizPosition ?? 0) + QUIZ_POSITION_STEP;

  await prisma.flashcard.update({
    where: { id: cardId },
    data: { quizPosition },
  });

  return quizPosition;
}

export async function getQuizQueueIds() {
  await ensureQuizPositions();

  const queueCards = await prisma.flashcard.findMany({
    where: { quizPosition: { not: null } },
    select: { id: true },
    orderBy: [{ quizPosition: 'asc' }, { id: 'asc' }],
  });

  return queueCards.map((card) => card.id);
}

export async function replaceQuizQueue(queueIds: string[]) {
  await ensureQuizPositions();

  const uniqueQueueIds = queueIds.filter((id, index) => queueIds.indexOf(id) === index);
  const existingCards = await prisma.flashcard.findMany({
    select: { id: true },
    orderBy: [{ quizPosition: 'asc' }, { id: 'asc' }],
  });
  const existingIdSet = new Set(existingCards.map((card) => card.id));
  const orderedRequestedIds = uniqueQueueIds.filter((id) => existingIdSet.has(id));
  const requestedIdSet = new Set(orderedRequestedIds);
  const remainingIds = existingCards
    .map((card) => card.id)
    .filter((id) => !requestedIdSet.has(id));
  const nextQueueIds = [...orderedRequestedIds, ...remainingIds];

  let nextPosition = QUIZ_POSITION_STEP;
  await prisma.$transaction(
    nextQueueIds.map((id) => {
      const quizPosition = nextPosition;
      nextPosition += QUIZ_POSITION_STEP;

      return prisma.flashcard.update({
        where: { id },
        data: { quizPosition },
      });
    })
  );

  return nextQueueIds;
}

export async function getQuizSession(limit: number) {
  await ensureQuizPositions();

  const [sessionCards, totalQueueCount, optionSourceCards] = await Promise.all([
    prisma.flashcard.findMany({
      where: { quizPosition: { not: null } },
      select: {
        id: true,
        word: true,
        translatedText: true,
        pronunciation: true,
      },
      orderBy: [{ quizPosition: 'asc' }, { id: 'asc' }],
      take: limit,
    }),
    prisma.flashcard.count({
      where: { quizPosition: { not: null } },
    }),
    prisma.flashcard.findMany({
      select: {
        id: true,
        translatedText: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: QUIZ_OPTIONS_POOL_SIZE,
    }),
  ]);

  const optionPool = Array.from(
    new Set([
      ...sessionCards.map((card) => card.translatedText),
      ...optionSourceCards.map((card) => card.translatedText),
    ])
  );

  return {
    totalQueueCount,
    cards: sessionCards.map((card) => ({
      ...card,
      options: buildQuestionOptions(card, optionPool),
    })),
  };
}

export async function completeQuizSession(quizCardIds: string[], mistakeCardIds: string[]) {
  await ensureQuizPositions();

  const queueCards = await prisma.flashcard.findMany({
    where: { quizPosition: { not: null } },
    select: { id: true, quizPosition: true },
    orderBy: [{ quizPosition: 'asc' }, { id: 'asc' }],
  });

  if (queueCards.length === 0) {
    return { totalQueueCount: 0 };
  }

  const queueIdSet = new Set(queueCards.map((card) => card.id));
  const validQuizCardIds = quizCardIds.filter((id, index) => queueIdSet.has(id) && quizCardIds.indexOf(id) === index);
  const validQuizIdSet = new Set(validQuizCardIds);
  const validMistakeIdSet = new Set(mistakeCardIds.filter((id) => validQuizIdSet.has(id)));
  const mistakenQuizIds = validQuizCardIds.filter((id) => validMistakeIdSet.has(id));
  const cleanQuizIds = validQuizCardIds.filter((id) => !validMistakeIdSet.has(id));
  const minQuizPosition = queueCards[0]?.quizPosition ?? QUIZ_POSITION_STEP;
  const maxQuizPosition = queueCards[queueCards.length - 1]?.quizPosition ?? QUIZ_POSITION_STEP;
  const updates = [];

  let nextTopPosition = minQuizPosition - mistakenQuizIds.length * QUIZ_POSITION_STEP;
  for (const id of mistakenQuizIds) {
    updates.push(
      prisma.flashcard.update({
        where: { id },
        data: { quizPosition: nextTopPosition },
      })
    );
    nextTopPosition += QUIZ_POSITION_STEP;
  }

  let nextBottomPosition = maxQuizPosition + QUIZ_POSITION_STEP;
  for (const id of cleanQuizIds) {
    updates.push(
      prisma.flashcard.update({
        where: { id },
        data: { quizPosition: nextBottomPosition },
      })
    );
    nextBottomPosition += QUIZ_POSITION_STEP;
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  return { totalQueueCount: queueCards.length };
}
