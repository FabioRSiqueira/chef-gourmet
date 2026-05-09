import React from 'react';
import { Link } from 'react-router-dom';
import { Recipe } from '../types';
import { ChefHat, Clock, BookOpen, PenLine } from 'lucide-react';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onClick }) => {
  // Count total ingredients for summary with safety check
  const ingredients = recipe.ingredients || [];
  const steps = recipe.steps || [];
  
  const totalIngredients = ingredients.reduce((acc, curr) => acc + (curr.items?.length || 0), 0);

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden border border-gray-100 flex flex-col h-full relative group"
    >
      <Link 
        to={`/manual/${recipe.id}`}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 z-20 p-2 bg-white/10 hover:bg-white/90 text-white hover:text-chef-red rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
        title="Editar Receita"
      >
        <PenLine className="w-4 h-4" />
      </Link>
      <div className="h-32 bg-chef-dark flex items-center justify-center relative">
        <ChefHat className="text-white/20 w-16 h-16 absolute" />
        <h3 className="text-white font-bold text-center px-4 z-10 line-clamp-2">
          {recipe.title || "Untitled Recipe"}
        </h3>
        <div className="absolute bottom-0 right-0 bg-chef-red text-white text-xs px-2 py-1 rounded-tl-lg font-medium">
          {recipe.lesson_name || "General"}
        </div>
      </div>
      
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
           <div className="flex items-center text-gray-500 text-sm mb-3">
             <BookOpen className="w-4 h-4 mr-1" />
             <span>{ingredients.length} Sections</span>
           </div>
           
           <p className="text-gray-600 text-sm line-clamp-3">
             {steps.length > 0 ? steps[0] : "No instructions available."}...
           </p>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 font-medium">
           <div className="flex items-center">
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {totalIngredients} Ingredients
              </span>
           </div>
           <div className="flex items-center">
             <Clock className="w-3 h-3 mr-1" />
             <span>View Recipe</span>
           </div>
        </div>
      </div>
    </div>
  );
};