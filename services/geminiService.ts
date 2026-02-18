import { GoogleGenAI, Type } from "@google/genai";
import { Recipe } from "../types";

const getApiKey = () => {
  let key = undefined;
  
  // Try Vite
  try {
    // @ts-ignore
    if (import.meta && import.meta.env) {
      // @ts-ignore
      key = import.meta.env.VITE_API_KEY || import.meta.env.API_KEY;
    }
  } catch (e) {}

  // Try Process
  if (!key) {
    try {
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env) {
        // @ts-ignore
        key = process.env.API_KEY || process.env.REACT_APP_API_KEY;
      }
    } catch(e) {}
  }
  
  return key;
}

const initGemini = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    // Return null instead of throwing to prevent app crash during module loading/initialization
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
            lesson_name: { type: Type.STRING, description: "Name of the lesson. If missing, use empty string." },
            title: { type: Type.STRING, description: "Title of the recipe." },
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

  const prompt = `
    Extract recipes from this text.
    TEXT: ${textChunk}
    Clean the data. Return JSON.
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

export const parseRecipesFromPages = async (pages: string[]): Promise<Recipe[]> => {
  const ai = initGemini();
  
  if (!ai) {
    // Throw error only when the user actually tries to process files
    throw new Error("Gemini API Key is missing. Please configure VITE_API_KEY in your environment variables.");
  }

  const CHUNK_SIZE = 2; 
  const chunks: string[] = [];

  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    chunks.push(pages.slice(i, i + CHUNK_SIZE).join('\n\n'));
  }

  try {
    const promiseResults = await Promise.all(
      chunks.map(chunk => processChunk(chunk, ai))
    );
    return promiseResults.flat();
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    if (error.message.includes("API Key")) throw error;
    throw new Error("Failed to process recipes with AI. Please try again.");
  }
};