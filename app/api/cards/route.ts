import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/src/lib/prisma';
import { appendCardToQuizQueue, ensureQuizPositions } from '@/src/lib/quizQueue';
import { translateWord } from '@/src/services/llmService';

const DEFAULT_PAGE_SIZE = 10;

const createFlashcardSchema = z.object({
  word: z.string().trim().min(1, 'Word obrigatoria').max(50, 'Word deve ter no maximo 50 caracteres'),
});

export async function GET(request: Request) {
  try {
    await ensureQuizPositions();

    const { searchParams } = new URL(request.url);
    const pageParam = Number(searchParams.get('page') ?? '1');
    const limitParam = Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE.toString());
    const search = searchParams.get('search')?.trim() ?? '';
    const loadAll = searchParams.get('all') === 'true';
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit = loadAll
      ? undefined
      : Number.isFinite(limitParam) && limitParam > 0
        ? Math.floor(limitParam)
        : DEFAULT_PAGE_SIZE;

    const where = search
      ? {
          OR: [
            {
              word: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            {
              translatedText: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : undefined;

    const [cards, total] = await Promise.all([
      prisma.flashcard.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(loadAll
          ? {}
          : {
              skip: (page - 1) * limit,
              take: limit,
            }),
      }),
      prisma.flashcard.count({ where }),
    ]);

    return NextResponse.json({
      items: cards,
      page,
      limit: loadAll ? total : limit,
      total,
      hasMore: loadAll ? false : page * limit < total,
    });
  } catch (error) {
    console.error("Prisma Fetch Error:", error);
    return NextResponse.json({ error: "Erro ao buscar cards" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const parsedData = createFlashcardSchema.safeParse(data);

    if (!parsedData.success) {
      return NextResponse.json({ error: parsedData.error.issues[0]?.message ?? 'Payload invalido' }, { status: 400 });
    }

    const normalizedWord = parsedData.data.word;

    const existingCard = await prisma.flashcard.findFirst({
      where: {
        word: {
          equals: normalizedWord,
          mode: 'insensitive',
        },
      },
    });

    if (existingCard) {
      return NextResponse.json({ error: 'Ja existe um card com essa word' }, { status: 409 });
    }

    const translation = await translateWord(normalizedWord);
    const newCard = await prisma.flashcard.create({
      data: {
        word: normalizedWord,
        translatedText: translation.translatedText,
        pronunciation: translation.pronunciation,
        exampleSentence: translation.exampleSentence,
        exampleTranslation: translation.exampleTranslation,
      },
    });

    await appendCardToQuizQueue(newCard.id);

    return NextResponse.json(newCard);
  } catch (error) {
    console.error("Prisma Create Error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ja existe um card com essa word' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Erro ao criar card" }, { status: 500 });
  }
}
