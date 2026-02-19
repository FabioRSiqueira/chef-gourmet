import { GoogleGenAI, Type } from "@google/genai";
import { Recipe } from "../types";

// Helper to pause execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Internal function to process a single chunk of text with Gemini
const processChunk = async (textChunk: string, retries = 3): Promise<Recipe[]> => {
  // Use process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `
    You are a specialized recipe extractor. 
    Analyze the provided text and extract culinary recipes into a strict JSON structure.
    
    Rules:
    1. If the text contains no recipes, return { "recipes": [] }.
    2. Extract ALL recipes found in the text.
    3. Be precise with quantities and units.
    4. Maintain the original language of the text (Portuguese).
  `;

  // Define the strict response schema
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      recipes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            lesson_name: { 
              type: Type.STRING, 
              description: "Title of the section or lesson, e.g. 'Aula 1 - Bases'"
            },
            title: { 
              type: Type.STRING,
              description: "Name of the recipe"
            },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sectionName: { 
                    type: Type.STRING,
                    description: "e.g. 'Massa', 'Recheio', 'Montagem'. Defaults to 'Ingredientes' if not specified."
                  },
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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: textChunk,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result.recipes || [];

  } catch (error: any) {
    console.warn("Gemini processing warning:", error);
    
    // Simple retry logic
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
  
  // Gemini Context Window management
  // Gemini 3 Flash has a large context window, but we keep chunking to manage output size and logical separation.
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
      
      // Small breather
      if (i < chunks.length - 1) await delay(500);
    }

    return allRecipes;
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    throw new Error("Failed to process recipes with AI. Please try again.");
  }
};