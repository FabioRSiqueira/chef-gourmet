import { GoogleGenAI } from "@google/genai";
import { Recipe } from "../types";

// Helper to pause execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get API Key safely across different environments (Vite, Webpack, Vercel)
export const getApiKey = (): string => {
  let key = "";

  // 1. Try Vite standard way (Most reliable for Vercel + Vite)
  // We explicitly check specific keys so the bundler doesn't optimize them away
  // Fix: Cast import.meta to any to allow access to .env which might not be in the default ImportMeta type
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    // @ts-ignore
    const env = (import.meta as any).env;
    key = env.VITE_GEMINI_API_KEY || 
          env.VITE_API_KEY || 
          env.GEMINI_API_KEY || 
          "";
  }
  
  // 2. Fallback to process.env
  if (!key && typeof process !== 'undefined' && process.env) {
    key = process.env.VITE_GEMINI_API_KEY || 
          process.env.VITE_API_KEY || 
          process.env.GEMINI_API_KEY || 
          process.env.API_KEY || 
          "";
  }

  return key;
}

// Internal function to process a single chunk of text with Gemini
const processChunk = async (textChunk: string, retries = 3): Promise<Recipe[]> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("API Key configuration error. Please ensure VITE_GEMINI_API_KEY is set in Vercel Environment Variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `
    Extract recipes from the text into a JSON object with a "recipes" array.
    Recognize tables (e.g., "Farinha 25 G").
    
    Format:
    {
      "recipes": [
        {
          "lesson_name": "String",
          "title": "String",
          "ingredients": [
            {
              "sectionName": "String (default 'Ingredientes')",
              "items": [{ "name": "String", "qty": "String", "unit": "String" }]
            }
          ],
          "steps": ["String"]
        }
      ]
    }
    Return ONLY valid JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: textChunk,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
      }
    });

    let jsonText = response.text || '{}';

    // Robust Cleaning
    const markdownMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/```\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
      jsonText = markdownMatch[1];
    }

    let result;
    try {
      result = JSON.parse(jsonText);
    } catch (e) {
      // Fallback: simple extraction
      const start = jsonText.indexOf('{');
      const end = jsonText.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        try {
          result = JSON.parse(jsonText.substring(start, end + 1));
        } catch (e2) {
          return [];
        }
      } else {
        return [];
      }
    }

    return result.recipes || [];

  } catch (error: any) {
    console.warn("Gemini processing warning:", error);
    
    if (retries > 0 && (error.status === 429 || error.status >= 500)) {
       await delay(1000 * (4 - retries)); 
       return processChunk(textChunk, retries - 1);
    }
    return [];
  }
};

export const parseRecipesFromPages = async (
  pages: string[], 
  onProgress?: (status: string) => void
): Promise<Recipe[]> => {
  
  // CHUNK_SIZE = 2 pages per request (faster than sending 4 or 10)
  const CHUNK_SIZE = 2; 
  const chunks: string[] = [];

  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    chunks.push(pages.slice(i, i + CHUNK_SIZE).join('\n\n'));
  }

  try {
    if (onProgress) onProgress(`Preparando ${chunks.length} partes para análise rápida...`);

    const allRecipes: Recipe[] = [];
    
    // BATCH_SIZE = 3 requests in parallel
    // This makes it significantly faster on Vercel/Production
    const BATCH_SIZE = 3;
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchIndices = batch.map((_, idx) => i + idx + 1);
      
      if (onProgress) {
        onProgress(`Processando lote ${Math.ceil((i + 1) / BATCH_SIZE)} (Partes ${batchIndices.join(', ')} de ${chunks.length})...`);
      }

      const results = await Promise.all(
        batch.map(chunk => processChunk(chunk))
      );

      results.forEach(recipes => allRecipes.push(...recipes));

      if (i + BATCH_SIZE < chunks.length) {
        await delay(200);
      }
    }

    return allRecipes;
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};