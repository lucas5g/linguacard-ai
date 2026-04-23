import { z } from 'zod';
import { env } from '@/src/env';
import type { TranslationResult } from '@/src/types/translation';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'google/gemini-3.1-flash-lite-preview';

const translationResultSchema = z.object({
  translatedText: z.string().trim().min(1),
  pronunciation: z.string().trim().min(1).optional(),
  exampleSentence: z.string().trim().min(1).optional(),
  exampleTranslation: z.string().trim().min(1).optional(),
});

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{
        type?: string;
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type OpenRouterMessageContent = string | Array<{
  type?: string;
  text?: string;
}> | undefined;

function getResponseText(content: OpenRouterMessageContent) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
  }

  return '';
}

function extractJsonPayload(rawText: string) {
  const trimmedText = rawText.trim();

  if (trimmedText.startsWith('```')) {
    return trimmedText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }

  return trimmedText;
}

export async function translateWord(word: string): Promise<TranslationResult> {
  if (!word.trim()) {
    throw new Error('Palavra não pode estar vazia');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Você traduz palavras do inglês para o português. Responda somente com JSON válido, sem markdown, sem comentários e sem texto adicional.',
        },
        {
          role: 'user',
          content: `Traduza a palavra do inglês para o português: "${word}". Retorne um JSON com as chaves translatedText, pronunciation, exampleSentence e exampleTranslation. translatedText é obrigatória. pronunciation deve ser uma pronúncia aproximada em português. exampleSentence deve ser uma frase curta em inglês usando a palavra. exampleTranslation deve ser a tradução da frase para o português.`,
        },
      ],
      response_format: {
        type: 'json_object',
      },
    }),
  });

  const data = await response.json() as OpenRouterResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Erro ao consultar OpenRouter');
  }

  const rawContent = data.choices?.[0]?.message?.content;
  const text = getResponseText(rawContent);

  if (!text) {
    throw new Error('Não foi possível obter a tradução');
  }

  try {
    const parsedContent = JSON.parse(extractJsonPayload(text));
    return translationResultSchema.parse(parsedContent);
  } catch (error) {
    console.error('Failed to parse AI response', text, error);
    throw new Error('Erro ao processar a resposta da IA');
  }
}
