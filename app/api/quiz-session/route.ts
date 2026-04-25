import { NextResponse } from 'next/server';
import { z } from 'zod';
import { completeQuizSession, getQuizSession } from '@/src/lib/quizQueue';

const DEFAULT_QUIZ_LENGTH = 10;

const completeQuizSchema = z.object({
  quizCardIds: z.array(z.string()),
  mistakeCardIds: z.array(z.string()),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit') ?? DEFAULT_QUIZ_LENGTH.toString());
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : DEFAULT_QUIZ_LENGTH;
    const session = await getQuizSession(limit);

    return NextResponse.json(session);
  } catch (error) {
    console.error('Quiz Session Fetch Error:', error);
    return NextResponse.json({ error: 'Erro ao carregar quiz' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const parsedData = completeQuizSchema.safeParse(data);

    if (!parsedData.success) {
      return NextResponse.json({ error: 'Resultado do quiz invalido' }, { status: 400 });
    }

    const result = await completeQuizSession(parsedData.data.quizCardIds, parsedData.data.mistakeCardIds);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Quiz Session Update Error:', error);
    return NextResponse.json({ error: 'Erro ao salvar resultado do quiz' }, { status: 500 });
  }
}
