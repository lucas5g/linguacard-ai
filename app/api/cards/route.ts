import { NextResponse } from 'next/server';
import prisma from '@/src/lib/prisma';

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
    const newCard = await prisma.flashcard.create({
      data: {
        word: data.word,
        translatedText: data.translatedText,
        pronunciation: data.pronunciation,
        exampleSentence: data.exampleSentence,
        exampleTranslation: data.exampleTranslation,
      },
    });
    return NextResponse.json(newCard);
  } catch (error) {
    console.error("Prisma Create Error:", error);
    return NextResponse.json({ error: "Erro ao criar card" }, { status: 500 });
  }
}
