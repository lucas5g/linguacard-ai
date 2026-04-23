import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/src/lib/prisma';
import { getReconciledQuizQueue } from '@/src/lib/quizQueue';
import { translateWord } from '@/src/services/llmService';

const createFlashcardSchema = z.object({
  word: z.string().trim().min(1, 'Word obrigatoria').max(50, 'Word deve ter no maximo 50 caracteres'),
});

export async function GET() {
  try {
    const cards = await prisma.flashcard.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(cards);
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

    await getReconciledQuizQueue();

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
