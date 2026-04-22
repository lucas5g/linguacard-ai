import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/src/lib/prisma';
import { getReconciledQuizQueue } from '@/src/lib/quizQueue';
import { translateWord } from '@/src/services/geminiService';

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
    const normalizedWord = typeof data.word === 'string' ? data.word.trim() : '';

    if (!normalizedWord) {
      return NextResponse.json({ error: 'Word obrigatoria' }, { status: 400 });
    }

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
