export interface Ingredient {
  name: string;
  qty: string;
  unit: string;
}

export interface IngredientSection {
  sectionName: string; // e.g., "Massa", "Recheio"
  items: Ingredient[];
}

export interface Recipe {
  id?: string;
  lesson_name: string;
  title: string;
  ingredients: IngredientSection[];
  steps: string[];
  created_at?: string;
}

export interface ParseResult {
  success: boolean;
  data?: Recipe[];
  error?: string;
}
