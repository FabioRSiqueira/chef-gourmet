import { createClient } from '@supabase/supabase-js';
import { Recipe } from '../types';

// Supabase Configuration
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL || "https://sczmttadkjgqrfsbppaj.supabase.co";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_ABegr6YyTLvtH_WxVrHI0g_BB4E1kRE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const LOCAL_STORAGE_KEY = 'chefshelf_recipes';

// Helper for ID generation if crypto.randomUUID is not available
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const saveRecipes = async (recipes: Recipe[]): Promise<boolean> => {
  // 1. Try Supabase
  try {
    const { error } = await supabase.from('recipes').insert(recipes);
    if (!error) return true;
    
    console.warn("Supabase insert failed (table likely missing), falling back to LocalStorage.", error);
  } catch (err) {
    console.warn("Supabase connection failed:", err);
  }

  // 2. Local Storage Fallback
  try {
    const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existing: Recipe[] = existingStr ? JSON.parse(existingStr) : [];
    
    // Add IDs and dates if missing (Supabase would usually handle this)
    const newRecipes = recipes.map(r => ({
      ...r,
      id: r.id || generateId(),
      created_at: r.created_at || new Date().toISOString()
    }));
    
    const updated = [...newRecipes, ...existing];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error("Local storage save failed:", e);
    throw new Error("Failed to save recipes to both database and local storage.");
  }
};

export const getRecipes = async (search?: string): Promise<Recipe[]> => {
  let useFallback = false;

  // 1. Try Supabase
  try {
    let query = supabase.from('recipes').select('*').order('created_at', { ascending: false });
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,lesson_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("Supabase fetch failed (table likely missing):", error);
      useFallback = true;
    } else {
      return data as Recipe[] || [];
    }
  } catch (error) {
    console.error("Supabase request failed:", error);
    useFallback = true;
  }

  // 2. Local Storage Fallback
  if (useFallback) {
    console.info("Using LocalStorage fallback for recipes.");
    const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    let allRecipes: Recipe[] = existingStr ? JSON.parse(existingStr) : [];
    
    if (search) {
      const lowerSearch = search.toLowerCase();
      allRecipes = allRecipes.filter(r => 
        (r.title && r.title.toLowerCase().includes(lowerSearch)) || 
        (r.lesson_name && r.lesson_name.toLowerCase().includes(lowerSearch))
      );
    }
    return allRecipes;
  }

  return [];
};