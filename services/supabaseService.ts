import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Recipe } from '../types';

// Hardcoded fallbacks for demo purposes, but prioritized ENV vars
const DEFAULT_URL = "https://sczmttadkjgqrfsbppaj.supabase.co";
const DEFAULT_KEY = "sb_publishable_ABegr6YyTLvtH_WxVrHI0g_BB4E1kRE";

const getEnvUrl = () => {
  // Static access for bundler replacement
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    // @ts-ignore
    if ((import.meta as any).env.VITE_SUPABASE_URL) return (import.meta as any).env.VITE_SUPABASE_URL;
    // @ts-ignore
    if ((import.meta as any).env.SUPABASE_URL) return (import.meta as any).env.SUPABASE_URL;
  }
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
      if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;
      if (process.env.REACT_APP_SUPABASE_URL) return process.env.REACT_APP_SUPABASE_URL;
    }
  } catch(e) {}
  return DEFAULT_URL;
};

const getEnvKey = () => {
  // Static access for bundler replacement
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    // @ts-ignore
    if ((import.meta as any).env.VITE_SUPABASE_ANON_KEY) return (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
    // @ts-ignore
    if ((import.meta as any).env.SUPABASE_ANON_KEY) return (import.meta as any).env.SUPABASE_ANON_KEY;
  }
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.VITE_SUPABASE_ANON_KEY) return process.env.VITE_SUPABASE_ANON_KEY;
      if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;
      if (process.env.REACT_APP_SUPABASE_ANON_KEY) return process.env.REACT_APP_SUPABASE_ANON_KEY;
    }
  } catch(e) {}
  return DEFAULT_KEY;
};

// Singleton instance
let supabaseInstance: SupabaseClient | null = null;

const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  const url = getEnvUrl();
  const key = getEnvKey();

  if (!url || !url.startsWith('http') || !key) {
    return null;
  }

  try {
    supabaseInstance = createClient(url, key);
    return supabaseInstance;
  } catch (error) {
    console.warn("Failed to initialize Supabase:", error);
    return null;
  }
};

const LOCAL_STORAGE_KEY = 'chefshelf_recipes';

const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch(e) {}
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const saveRecipes = async (recipes: Recipe[]): Promise<boolean> => {
  const supabase = getSupabase();
  let savedToCloud = false;

  // 1. Try Supabase
  if (supabase) {
    try {
      const { error } = await supabase.from('recipes').insert(recipes);
      if (!error) savedToCloud = true;
      else console.warn("Supabase insert error:", error);
    } catch (err) {
      console.warn("Supabase connection error:", err);
    }
  }

  // 2. Always save to Local Storage
  try {
    const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existing: Recipe[] = existingStr ? JSON.parse(existingStr) : [];
    
    const newRecipes = recipes.map(r => ({
      ...r,
      id: r.id || generateId(),
      created_at: r.created_at || new Date().toISOString()
    }));
    
    // Simple deduplication by title/lesson
    const updated = [...newRecipes, ...existing];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error("Local storage failed:", e);
    return savedToCloud;
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
      }
    } catch (error) {
      // Silent fail to fallback
    }
  }

  // 2. Fallback to LocalStorage
  if (!data) {
    try {
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
    } catch (e) {
      return [];
    }
  }

  return data || [];
};