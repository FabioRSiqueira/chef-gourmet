import { GoogleGenAI } from "@google/genai";
import { Recipe } from "../types";

// Helper to pause execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// CRITICAL FIX FOR VERCEL/VITE:
// Vite statically replaces 'import.meta.env.VITE_KEY' strings during build.
// Dynamic access (e.g., env[key] or const env = import.meta.env) FAILS in production.
// We must check each expected key explicitly.
export const getApiKey = (): string => {
  // 1. Try Vite Static Replacement (Production)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    if (import.meta.env.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
    // @ts-ignore
    if (import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
    // @ts-ignore
    if (import.meta.env.GEMINI_API_KEY) return import.meta.env.GEMINI_API_KEY;
  }
  
  // 2. Fallback to process.env (Node/Webpack compatibility)
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
      if (process.env.VITE_API_KEY) return process.env.VITE_API_KEY;
      if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
      if (process.env.API_KEY) return process.env.API_KEY;
    }
  } catch (e) {}

  return "";
}

// Internal function to process a single chunk of text with Gemini
const processChunk = async (textChunk: string, retries = 3): Promise<Recipe[]> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("API Key configuration error. Please ensure 'VITE_GEMINI_API_KEY' is set in Vercel Environment Variables.");
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
    
    // Rate limit handling (429)
    if (retries > 0 && (error.status === 429 || error.status >= 500)) {
       await delay(1500 * (4 - retries)); 
       return processChunk(textChunk, retries - 1);
    }
    return [];
  }
};

export const parseRecipesFromPages = async (
  pages: string[], 
  onProgress?: (status: string) => void
): Promise<Recipe[]> => {
  
  // OPTIMIZATION FOR SPEED:
  // CHUNK_SIZE: 2 pages per request keeps the prompt small and response fast.
  const CHUNK_SIZE = 2; 
  const chunks: string[] = [];

  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    chunks.push(pages.slice(i, i + CHUNK_SIZE).join('\n\n'));
  }

  try {
    if (onProgress) onProgress(`Preparando ${chunks.length} partes para análise rápida...`);

    const allRecipes: Recipe[] = [];
    
    // OPTIMIZATION FOR SPEED:
    // BATCH_SIZE: 5 concurrent requests. Gemini Flash is fast and handles concurrency well.
    // This dramatically reduces total time on Vercel compared to sequential processing.
    const BATCH_SIZE = 5;
    
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

      // Minimal delay to allow UI updates and prevent total browser freeze
      if (i + BATCH_SIZE < chunks.length) {
        await delay(100);
      }
    }

    return allRecipes;
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};