import { GoogleGenAI, Type } from "@google/genai";
import { Recipe } from "../types";

const getApiKey = () => {
  // Vite replaces specific string patterns at build time.
  // We MUST access these properties directly, not via dynamic keys (e.g. process.env[key]).
  
  // 1. Check for VITE_API_KEY (Standard for Vite)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_KEY) {
    // @ts-ignore
    return (import.meta as any).env.VITE_API_KEY;
  }

  // 2. Check for API_KEY (Fallback)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.API_KEY) {
    // @ts-ignore
    return (import.meta as any).env.API_KEY;
  }

  // 3. Process.env fallback (for some Vercel/Webpack setups)
  // We use direct access so the bundler can inline the value.
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.VITE_API_KEY) return process.env.VITE_API_KEY;
      if (process.env.API_KEY) return process.env.API_KEY;
      if (process.env.REACT_APP_API_KEY) return process.env.REACT_APP_API_KEY;
    }
  } catch (e) {}
  
  return undefined;
}

const initGemini = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// Internal function to process a single chunk of text
const processChunk = async (textChunk: string, ai: GoogleGenAI): Promise<Recipe[]> => {
  const schema = {
    type: Type.OBJECT,
    properties: {
      recipes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            lesson_name: { type: Type.STRING, description: "Lesson name" },
            title: { type: Type.STRING, description: "Recipe title" },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sectionName: { type: Type.STRING },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        qty: { type: Type.STRING },
                        unit: { type: Type.STRING }
                      }
                    }
                  }
                }
              }
            },
            steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    }
  };

  // Highly optimized prompt for speed
  const prompt = `
    Extract recipes to JSON.
    TEXT: ${textChunk}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.1,
      }
    });

    const result = JSON.parse(response.text || '{}');
    const rawRecipes = result.recipes || [];

    return rawRecipes.map((r: any) => ({
      lesson_name: r.lesson_name || "",
      title: r.title || "Receita Sem Nome",
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      steps: Array.isArray(r.steps) ? r.steps : [],
    }));

  } catch (error) {
    console.warn("Chunk processing warning:", error);
    return [];
  }
};

export const parseRecipesFromPages = async (
  pages: string[], 
  onProgress?: (status: string) => void
): Promise<Recipe[]> => {
  const ai = initGemini();
  
  if (!ai) {
    throw new Error("Gemini API Key is missing. Please set 'VITE_API_KEY' in your Vercel Environment Variables.");
  }

  // INCREASED CHUNK SIZE TO 80:
  // Maximizes context window usage. 
  // Most PDFs will now be processed in a single API call.
  const CHUNK_SIZE = 80; 
  const chunks: string[] = [];

  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    chunks.push(pages.slice(i, i + CHUNK_SIZE).join('\n\n'));
  }

  try {
    if (onProgress) onProgress(`Analisando ${chunks.length} parte(s) do documento...`);

    // Parallel processing of chunks
    const promiseResults = await Promise.all(
      chunks.map(async (chunk, idx) => {
        const res = await processChunk(chunk, ai);
        if (onProgress) onProgress(`Parte ${idx + 1}/${chunks.length} concluída...`);
        return res;
      })
    );
    return promiseResults.flat();
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    if (error.message.includes("API Key")) throw error;
    throw new Error("Failed to process recipes with AI. Please try again.");
  }
};