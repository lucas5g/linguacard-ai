import prisma from '@/src/lib/prisma';

export function areQueueIdsEqual(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((item, index) => item === second[index]);
}

export function reconcileQueueIds(cardIds: string[], savedQueueIds: string[]) {
  const currentIdSet = new Set(cardIds);
  const validSavedIds = savedQueueIds.filter((id) => currentIdSet.has(id));
  const savedIdSet = new Set(validSavedIds);
  const newIds = cardIds.filter((id) => !savedIdSet.has(id));

  return [...validSavedIds, ...newIds];
}

export async function normalizeQueueIds(queueIds: string[]) {
  const uniqueQueueIds = queueIds.filter((id, index) => queueIds.indexOf(id) === index);

  if (uniqueQueueIds.length === 0) {
    return [];
  }

  const existingCards = await prisma.flashcard.findMany({
    where: {
      id: {
        in: uniqueQueueIds,
      },
    },
    select: { id: true },
  });

  const existingIdSet = new Set(existingCards.map((card) => card.id));

  return uniqueQueueIds.filter((id) => existingIdSet.has(id));
}

export async function replaceQuizQueue(queueIds: string[]) {
  const normalizedQueueIds = await normalizeQueueIds(queueIds);

  await prisma.$transaction([
    prisma.quizQueueItem.deleteMany(),
    ...(normalizedQueueIds.length > 0
      ? [
          prisma.quizQueueItem.createMany({
            data: normalizedQueueIds.map((flashcardId, index) => ({
              flashcardId,
              position: index,
            })),
          }),
        ]
      : []),
  ]);
}

export async function getReconciledQuizQueue() {
  const [cards, queueItems] = await Promise.all([
    prisma.flashcard.findMany({
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quizQueueItem.findMany({
      select: { flashcardId: true },
      orderBy: { position: 'asc' },
    }),
  ]);

  const reconciledQueueIds = reconcileQueueIds(
    cards.map((card) => card.id),
    queueItems.map((queueItem) => queueItem.flashcardId)
  );

  if (!areQueueIdsEqual(reconciledQueueIds, queueItems.map((queueItem) => queueItem.flashcardId))) {
    await replaceQuizQueue(reconciledQueueIds);
  }

  return reconciledQueueIds;
}
