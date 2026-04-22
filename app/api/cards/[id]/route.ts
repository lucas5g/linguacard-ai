import { NextResponse } from 'next/server';
import prisma from '@/src/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.flashcard.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Prisma Delete Error:", error);
    return NextResponse.json({ error: "Erro ao excluir card" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { isFlipped } = await request.json();
    const updated = await prisma.flashcard.update({
      where: { id },
      data: { isFlipped },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Prisma Update Error:", error);
    return NextResponse.json({ error: "Erro ao atualizar card" }, { status: 500 });
  }
}
