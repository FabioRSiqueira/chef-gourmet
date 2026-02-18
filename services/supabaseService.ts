import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Recipe } from '../types';

// Helper to safely access environment variables without crashing in browser
const getEnv = (key: string) => {
  // Check for Vite injected env vars
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    const val = import.meta.env[key] || import.meta.env[`VITE_${key}`];
    if (val) return val;
  }
  
  // Check for process.env (Node/Polyfill)
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env) {
    // @ts-ignore
    return process.env[key] || process.env[`REACT_APP_${key}`];
  }

  return undefined;
};

// Singleton instance
let supabaseInstance: SupabaseClient | null = null;
let hasTriedInit = false;

const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;
  if (hasTriedInit) return null; // Prevent repeated retry spam

  hasTriedInit = true;
  
  const url = getEnv('SUPABASE_URL') || "https://sczmttadkjgqrfsbppaj.supabase.co";
  const key = getEnv('SUPABASE_ANON_KEY') || "sb_publishable_ABegr6YyTLvtH_WxVrHI0g_BB4E1kRE";

  // Basic validation to prevent immediate crash on invalid URL
  if (!url || !url.startsWith('http') || !key) {
    console.warn("Invalid Supabase credentials. Running in LocalStorage mode.");
    return null;
  }

  try {
    supabaseInstance = createClient(url, key);
    return supabaseInstance;
  } catch (error) {
    console.warn("Failed to initialize Supabase client:", error);
    return null;
  }
};

const LOCAL_STORAGE_KEY = 'chefshelf_recipes';

// Helper for ID generation
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const saveRecipes = async (recipes: Recipe[]): Promise<boolean> => {
  const supabase = getSupabase();
  let savedToCloud = false;

  // 1. Try Supabase if available
  if (supabase) {
    try {
      const { error } = await supabase.from('recipes').insert(recipes);
      if (!error) savedToCloud = true;
      else console.warn("Supabase insert failed:", error);
    } catch (err) {
      console.warn("Supabase connection failed:", err);
    }
  }

  // 2. Always save to Local Storage as backup/primary
  try {
    const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existing: Recipe[] = existingStr ? JSON.parse(existingStr) : [];
    
    // Add IDs and dates if missing
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
    // If we managed to save to cloud but not local, return true anyway
    if (savedToCloud) return true;
    throw new Error("Failed to save recipes.");
  }
};

export const getRecipes = async (search?: string): Promise<Recipe[]> => {
  const supabase = getSupabase();
  let data: Recipe[] | null = null;

  // 1. Try Supabase
  if (supabase) {
    try {
      let query = supabase.from('recipes').select('*').order('created_at', { ascending: false });
      
      if (search) {
        query = query.or(`title.ilike.%${search}%,lesson_name.ilike.%${search}%`);
      }

      const result = await query;
      if (!result.error) {
        data = result.data as Recipe[];
      } else {
        console.warn("Supabase fetch error:", result.error);
      }
    } catch (error) {
      console.error("Supabase request failed:", error);
    }
  }

  // 2. Fallback to LocalStorage if Supabase failed or returned nothing
  if (!data) {
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

  return data || [];
};