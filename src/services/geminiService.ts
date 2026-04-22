import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });

export interface TranslationResult {
  translatedText: string;
  pronunciation?: string;
  exampleSentence?: string;
  exampleTranslation?: string;
}

export async function translateWord(word: string): Promise<TranslationResult> {
  if (!word.trim()) {
    throw new Error("Palavra não pode estar vazia");
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Traduza a seguinte palavra do inglês para o português: "${word}". Forneça também a pronúncia aproximada, uma frase de exemplo em inglês e sua tradução em português.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translatedText: {
            type: Type.STRING,
            description: "A tradução da palavra para o português.",
          },
          pronunciation: {
            type: Type.STRING,
            description: "Pronúncia figurada da palavra.",
          },
          exampleSentence: {
            type: Type.STRING,
            description: "Uma frase de exemplo curta usando a palavra em inglês.",
          },
          exampleTranslation: {
            type: Type.STRING,
            description: "A tradução da frase de exemplo para o português.",
          },
        },
        required: ["translatedText"],
      },
    },
  });

  if (!response.text) {
    throw new Error("Não foi possível obter a tradução");
  }

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse AI response", response.text);
    throw new Error("Erro ao processar a resposta da IA");
  }
}
