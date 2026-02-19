import { GoogleGenAI } from "@google/genai";
import { Recipe } from "../types";

// Helper to pause execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get API Key safely across different environments (Vite, Webpack, Vercel)
const getApiKey = (): string => {
  // 1. Try Vite standard way (import.meta.env)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    if (import.meta.env.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
    // @ts-ignore
    if (import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
    // @ts-ignore
    if (import.meta.env.GEMINI_API_KEY) return import.meta.env.GEMINI_API_KEY;
  }
  
  // 2. Try process.env (Standard Node/Webpack/Polyfilled)
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.API_KEY) return process.env.API_KEY;
      if (process.env.VITE_API_KEY) return process.env.VITE_API_KEY;
      if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    }
  } catch (e) {}

  return "";
}

// Internal function to process a single chunk of text with Gemini
const processChunk = async (textChunk: string, retries = 3): Promise<Recipe[]> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("API Key is missing. Please set VITE_GEMINI_API_KEY in your Vercel/Environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // More permissive prompt that handles the specific table format seen in the PDF
  const systemInstruction = `
    You are a professional recipe extractor.
    Your task is to identify and extract recipes from the provided text.

    The text often contains tables with columns like: "Descrição", "Qtd", "Medida".
    Example line from PDF: "Farinha 25 G" -> Ingredient: Farinha, Qty: 25, Unit: G.
    
    Structure the output as a JSON object containing a "recipes" array.
    
    JSON Structure:
    {
      "recipes": [
        {
          "lesson_name": "String (e.g. 'Panificação – Aula 04')",
          "title": "String (e.g. 'FOCACCIA', 'PIZZA')",
          "ingredients": [
            {
              "sectionName": "String (e.g. 'Massa', 'Recheio', 'Esponja'). Default to 'Ingredientes'",
              "items": [
                { "name": "String", "qty": "String (number)", "unit": "String (g, ml, colher, etc)" }
              ]
            }
          ],
          "steps": ["String (instruction step)"]
        }
      ]
    }

    Rules:
    1. Extract ALL recipes found.
    2. If a quantity is missing, leave "qty" empty string.
    3. Detect sections like "MASSA", "RECHEIO", "MOLHO" effectively.
    4. Return ONLY valid JSON. Do not add markdown blocks like \`\`\`json if possible, but if you do, the parser will handle it.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: textChunk,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        // Removed strict responseSchema to prevent validation failures on loose text
      }
    });

    let jsonText = response.text || '{}';

    // Robust Cleaning: Remove markdown formatting if present
    const markdownMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/```\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
      jsonText = markdownMatch[1];
    }

    // Try parsing
    let result;
    try {
      result = JSON.parse(jsonText);
    } catch (e) {
      console.warn("JSON parse failed, attempting loose extraction", e);
      // Fallback: try to find the first { and last }
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
       await delay(2000);
       return processChunk(textChunk, retries - 1);
    }
    return [];
  }
};

export const parseRecipesFromPages = async (
  pages: string[], 
  onProgress?: (status: string) => void
): Promise<Recipe[]> => {
  
  // Chunk size
  const CHUNK_SIZE = 4; 
  const chunks: string[] = [];

  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    chunks.push(pages.slice(i, i + CHUNK_SIZE).join('\n\n'));
  }

  try {
    if (onProgress) onProgress(`Preparando ${chunks.length} parte(s) para análise...`);

    const allRecipes: Recipe[] = [];

    // Sequential processing
    for (let i = 0; i < chunks.length; i++) {
      if (onProgress) onProgress(`Analisando parte ${i + 1} de ${chunks.length} com Gemini AI...`);
      
      const chunkRecipes = await processChunk(chunks[i]);
      allRecipes.push(...chunkRecipes);
      
      if (i < chunks.length - 1) await delay(500);
    }

    return allRecipes;
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};