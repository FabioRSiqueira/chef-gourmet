import { GoogleGenAI, Type } from "@google/genai";
import { Recipe } from "../types";

const initGemini = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
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
            lesson_name: { type: Type.STRING, description: "Name of the lesson, e.g., 'Aula 05 - Bolos'. If missing, use empty string." },
            title: { type: Type.STRING, description: "The clear, capitalized title of the recipe." },
            ingredients: {
              type: Type.ARRAY,
              description: "Ingredients grouped by section (e.g. 'Massa', 'Recheio'). If no sections exist, use 'Principal'.",
              items: {
                type: Type.OBJECT,
                properties: {
                  sectionName: { type: Type.STRING, description: "Title of the section (e.g., 'Massa', 'Calda')" },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING, description: "Ingredient name ONLY (e.g. 'Farinha de Trigo')" },
                        qty: { type: Type.STRING, description: "Numeric quantity (e.g. '200', '1/2'). Empty if none." },
                        unit: { type: Type.STRING, description: "Unit (e.g. 'g', 'ml', 'xícara'). Empty if none." }
                      }
                    }
                  }
                }
              }
            },
            steps: {
              type: Type.ARRAY,
              description: "Step-by-step instructions. Break long paragraphs into individual steps.",
              items: { type: Type.STRING }
            }
          }
        }
      }
    }
  };

  const prompt = `
    You are a professional cookbook editor. Your task is to EXTRACT, CLEAN, and ORGANIZE recipes from raw PDF text.

    RAW TEXT:
    ${textChunk}

    STRICT GUIDELINES:
    1. **Clean Data**: Remove artifacts like "Page 1", "www.site.com", header/footers, or random dividers.
    2. **Titles**: Ensure the recipe title is proper Title Case (e.g., "Bolo de Cenoura" not "BOLO DE CENOURA").
    3. **Ingredients**: 
       - Separate the Quantity, Unit, and Name properly.
       - Example input: "200g de farinha" -> qty: "200", unit: "g", name: "farinha".
       - Example input: "1 xícara de açúcar" -> qty: "1", unit: "xícara", name: "açúcar".
       - Group them logically. If the text says "Massa:" followed by ingredients, put them in a "Massa" section.
    4. **Steps**:
       - Do NOT return one huge paragraph. Split instructions into logical, sequential steps.
       - Remove numbering from the text itself (e.g., remove "1.", "2.") as the UI handles that.
       - Fix broken sentences caused by PDF line breaks.

    Return ONLY JSON.
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

    // Sanitize data to ensure arrays exist
    return rawRecipes.map((r: any) => ({
      lesson_name: r.lesson_name || "",
      title: r.title || "Receita Sem Nome",
      ingredients: Array.isArray(r.ingredients) ? r.ingredients.map((s: any) => ({
        sectionName: s.sectionName || "Ingredientes",
        items: Array.isArray(s.items) ? s.items : []
      })) : [],
      steps: Array.isArray(r.steps) ? r.steps : [],
    }));

  } catch (error) {
    console.warn("Chunk processing warning:", error);
    return []; // Return empty array on chunk error to not fail entire process
  }
};

export const parseRecipesFromPages = async (pages: string[]): Promise<Recipe[]> => {
  const ai = initGemini();

  const CHUNK_SIZE = 2; 
  const chunks: string[] = [];

  for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
    chunks.push(pages.slice(i, i + CHUNK_SIZE).join('\n\n'));
  }

  try {
    const promiseResults = await Promise.all(
      chunks.map(chunk => processChunk(chunk, ai))
    );

    const allRecipes = promiseResults.flat();
    const uniqueRecipes = Array.from(new Map(allRecipes.map(item => [item.title, item])).values());

    return uniqueRecipes;

  } catch (error: any) {
    console.error("Gemini Parallel Extraction Error:", error);
    
    let errorMessage = "Failed to process recipes.";
    if (error.message?.includes("404")) {
      errorMessage = "AI Model unavailable.";
    } else if (error.message?.includes("429")) {
      errorMessage = "Too many requests. Please wait a moment.";
    }
    throw new Error(errorMessage);
  }
};