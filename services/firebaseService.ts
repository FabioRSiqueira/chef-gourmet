import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Recipe } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const COLLECTION_NAME = 'recipes';
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
  let savedToCloud = false;

  // 1. Try Firebase
  try {
    const recipesCollection = collection(db, COLLECTION_NAME);
    const savePromises = recipes.map(recipe => {
      const { id, ...recipeData } = recipe; // Remove ID if present for new docs
      return addDoc(recipesCollection, {
        ...recipeData,
        created_at: serverTimestamp()
      });
    });
    await Promise.all(savePromises);
    savedToCloud = true;
  } catch (error) {
    console.error("Firebase save error:", error);
  }

  // 2. Always save to Local Storage (backward compatibility and offline support)
  try {
    const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existing: Recipe[] = existingStr ? JSON.parse(existingStr) : [];
    
    const newRecipes = recipes.map(r => ({
      ...r,
      id: r.id || generateId(),
      created_at: r.created_at || new Date().toISOString()
    }));
    
    const updated = [...newRecipes, ...existing];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error("Local storage failed:", e);
    return savedToCloud;
  }
};

export const updateRecipe = async (id: string, recipe: Partial<Recipe>): Promise<boolean> => {
  let updatedCloud = false;

  // 1. Try Firebase
  try {
    const recipeDoc = doc(db, COLLECTION_NAME, id);
    const { id: _, created_at, ...updateData } = recipe as any;
    await updateDoc(recipeDoc, {
      ...updateData,
      updated_at: serverTimestamp()
    });
    updatedCloud = true;
  } catch (error) {
    console.error("Firebase update error:", error);
    // If it fails on Firebase, it might be a local-only recipe, so we continue to localStorage
  }

  // 2. Update LocalStorage
  try {
    const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (existingStr) {
      const existing: Recipe[] = JSON.parse(existingStr);
      const updated = existing.map(r => r.id === id ? { ...r, ...recipe } : r);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
    return true;
  } catch (e) {
    console.error("Local storage update failed:", e);
    return updatedCloud;
  }
};

export const deleteRecipe = async (id: string): Promise<boolean> => {
    try {
        const recipeDoc = doc(db, COLLECTION_NAME, id);
        await deleteDoc(recipeDoc);
    } catch (e) {
        console.error("Firebase delete failed:", e);
    }

    try {
        const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (existingStr) {
            const existing: Recipe[] = JSON.parse(existingStr);
            const updated = existing.filter(r => r.id !== id);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        }
        return true;
    } catch (e) {
        console.error("Local storage delete failed:", e);
        return false;
    }
}

export const getRecipeById = async (id: string): Promise<Recipe | null> => {
  // 1. Try Firebase
  try {
    const recipeDoc = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(recipeDoc);
    if (docSnap.exists()) {
      const d = docSnap.data();
      return {
        ...d,
        id: docSnap.id,
        created_at: d.created_at instanceof Timestamp ? d.created_at.toDate().toISOString() : d.created_at
      } as Recipe;
    }
  } catch (error) {
    console.error("Firebase get error:", error);
  }

  // 2. Fallback to LocalStorage
  try {
    const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existing: Recipe[] = existingStr ? JSON.parse(existingStr) : [];
    return existing.find(r => r.id === id) || null;
  } catch (e) {
    return null;
  }
};

export const getRecipes = async (search?: string): Promise<Recipe[]> => {
  let data: Recipe[] | null = null;

  // 1. Try Firebase
  try {
    const recipesCollection = collection(db, COLLECTION_NAME);
    let q = query(recipesCollection, orderBy('created_at', 'desc'));
    
    // Simple search filtering (Firebase doesn't have native iLike, so we filter locally for now to keep it simple or use client-side search)
    // For more robust search, we could use Algolia or just fetch and filter client-side if the collection is small.
    const querySnapshot = await getDocs(q);
    data = querySnapshot.docs.map(doc => {
        const d = doc.data();
        return {
            ...d,
            id: doc.id,
            created_at: d.created_at instanceof Timestamp ? d.created_at.toDate().toISOString() : d.created_at
        } as Recipe;
    });

    if (search) {
        const lowerSearch = search.toLowerCase();
        data = data.filter(r => 
            (r.title && r.title.toLowerCase().includes(lowerSearch)) || 
            (r.lesson_name && r.lesson_name.toLowerCase().includes(lowerSearch))
        );
    }
  } catch (error) {
    console.error("Firebase fetch error:", error);
  }

  // 2. Fallback to LocalStorage
  if (!data || data.length === 0) {
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
