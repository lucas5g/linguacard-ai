import { NextResponse } from 'next/server';
import { getReconciledQuizQueue, replaceQuizQueue } from '@/src/lib/quizQueue';

export async function GET() {
  try {
    const queueIds = await getReconciledQuizQueue();
    return NextResponse.json(queueIds);
  } catch (error) {
    console.error('Quiz Queue Fetch Error:', error);
    return NextResponse.json({ error: 'Erro ao buscar fila do quiz' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const queueIds = Array.isArray(data?.queueIds)
      ? data.queueIds.filter((item): item is string => typeof item === 'string')
      : null;

    if (!queueIds) {
      return NextResponse.json({ error: 'Fila invalida' }, { status: 400 });
    }

    await replaceQuizQueue(queueIds);
    const reconciledQueueIds = await getReconciledQuizQueue();

    return NextResponse.json(reconciledQueueIds);
  } catch (error) {
    console.error('Quiz Queue Update Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar fila do quiz';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
