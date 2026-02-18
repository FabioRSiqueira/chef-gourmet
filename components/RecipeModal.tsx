import React from 'react';
import { Recipe } from '../types';
import { X, Printer, ChefHat, Clock, Utensils } from 'lucide-react';

interface RecipeModalProps {
  recipe: Recipe | null;
  onClose: () => void;
}

export const RecipeModal: React.FC<RecipeModalProps> = ({ recipe, onClose }) => {
  if (!recipe) return null;
  
  const ingredients = recipe.ingredients || [];
  const steps = recipe.steps || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-5 flex items-start justify-between shrink-0">
          <div className="flex gap-4">
            <div className="w-14 h-14 bg-chef-dark text-white rounded-lg flex items-center justify-center shrink-0 shadow-lg">
              <ChefHat className="w-8 h-8" />
            </div>
            <div>
              <span className="inline-block px-2 py-0.5 rounded-md bg-red-50 text-chef-red text-xs font-bold tracking-wider mb-1">
                {recipe.lesson_name || "RECEITA"}
              </span>
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-gray-900 leading-tight">
                {recipe.title || "Untitled Recipe"}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button 
               onClick={() => window.print()}
               className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors hidden sm:block"
               title="Print Recipe"
             >
               <Printer className="w-5 h-5" />
             </button>
             <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 md:p-10 bg-gray-50/50 grow">
          <div className="grid lg:grid-cols-12 gap-10">
            
            {/* Left Column: Ingredients (4/12 columns) */}
            <div className="lg:col-span-4 space-y-8">
              <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                <Utensils className="w-5 h-5 text-chef-red" />
                <h3 className="font-bold text-lg text-gray-800 uppercase tracking-wide">Ingredientes</h3>
              </div>

              {ingredients.length === 0 ? (
                <p className="text-gray-400 italic text-sm">Nenhum ingrediente identificado.</p>
              ) : (
                ingredients.map((section, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    {section.sectionName && section.sectionName.toLowerCase() !== 'ingredientes' && section.sectionName.toLowerCase() !== 'principal' && (
                      <h4 className="font-bold text-chef-red mb-3 text-sm border-b border-red-50 pb-1">
                        {section.sectionName}
                      </h4>
                    )}
                    <ul className="space-y-3">
                      {(section.items || []).map((item, i) => (
                        <li key={i} className="flex items-start text-sm group">
                          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full mt-1.5 mr-3 group-hover:bg-chef-red transition-colors"></div>
                          <div className="flex-1">
                            {(item.qty || item.unit) && (
                              <span className="font-bold text-gray-900 mr-1">
                                {item.qty} {item.unit}
                              </span>
                            )}
                            <span className="text-gray-600">{item.name}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>

            {/* Right Column: Instructions (8/12 columns) */}
            <div className="lg:col-span-8">
              <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-2">
                <Clock className="w-5 h-5 text-chef-red" />
                <h3 className="font-bold text-lg text-gray-800 uppercase tracking-wide">Modo de Preparo</h3>
              </div>

              <div className="space-y-6">
                {steps.length === 0 ? (
                   <p className="text-gray-400 italic">Nenhum modo de preparo identificado.</p>
                ) : (
                  steps.map((step, idx) => (
                    <div key={idx} className="flex gap-5 group bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all hover:border-red-100">
                      <div className="flex-shrink-0">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-chef-red font-bold text-sm group-hover:bg-chef-red group-hover:text-white transition-colors border border-red-100">
                          {idx + 1}
                        </span>
                      </div>
                      <p className="text-gray-700 leading-relaxed text-base pt-0.5">
                        {step}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
        
        {/* Footer info */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 text-center">
             <p className="text-xs text-gray-400">Extraído via Gemini AI • ChefShelf</p>
        </div>
      </div>
    </div>
  );
};