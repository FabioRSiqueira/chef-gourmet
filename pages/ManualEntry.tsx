import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft, PlusCircle, ListOrdered, Utensils, X } from 'lucide-react';
import { saveRecipes } from '../services/supabaseService';
import { Recipe, IngredientSection, Ingredient } from '../types';

export const ManualEntry: React.FC = () => {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recipe, setRecipe] = useState<Omit<Recipe, 'id' | 'created_at'>>({
    title: '',
    lesson_name: '',
    ingredients: [
      {
        sectionName: 'Ingredientes',
        items: [{ name: '', qty: '', unit: '' }]
      }
    ],
    steps: ['']
  });

  const handleAddSection = () => {
    setRecipe(prev => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { sectionName: '', items: [{ name: '', qty: '', unit: '' }] }
      ]
    }));
  };

  const handleRemoveSection = (sectionIndex: number) => {
    setRecipe(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== sectionIndex)
    }));
  };

  const handleAddIngredient = (sectionIndex: number) => {
    const newIngredients = [...recipe.ingredients];
    newIngredients[sectionIndex].items.push({ name: '', qty: '', unit: '' });
    setRecipe(prev => ({ ...prev, ingredients: newIngredients }));
  };

  const handleRemoveIngredient = (sectionIndex: number, ingredientIndex: number) => {
    const newIngredients = [...recipe.ingredients];
    newIngredients[sectionIndex].items = newIngredients[sectionIndex].items.filter((_, i) => i !== ingredientIndex);
    setRecipe(prev => ({ ...prev, ingredients: newIngredients }));
  };

  const handleAddStep = () => {
    setRecipe(prev => ({ ...prev, steps: [...prev.steps, ''] }));
  };

  const handleRemoveStep = (index: number) => {
    setRecipe(prev => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    if (!recipe.title.trim()) {
      setError('O título da receita é obrigatório.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Clean up empty ingredients and steps
      const cleanedRecipe: Recipe = {
        ...recipe,
        ingredients: recipe.ingredients.map(section => ({
          ...section,
          items: section.items.filter(item => item.name.trim() !== '')
        })).filter(section => section.items.length > 0 || section.sectionName.trim() !== ''),
        steps: recipe.steps.filter(step => step.trim() !== '')
      };

      if (cleanedRecipe.ingredients.length === 0 && cleanedRecipe.steps.length === 0) {
        throw new Error('Adicione pelo menos alguns ingredientes ou passos.');
      }

      await saveRecipes([cleanedRecipe]);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar a receita.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Voltar</span>
        </button>
        <h1 className="text-3xl font-serif font-bold text-gray-900">Nova Receita Manual</h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-chef-red text-white px-6 py-2 rounded-full font-bold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : (
            <>
              <Save className="w-4 h-4" />
              <span>Salvar Receita</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 flex items-center gap-3">
          <PlusCircle className="w-5 h-5 rotate-45" />
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-8">
        {/* Basic Info */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Título da Receita</label>
              <input
                type="text"
                value={recipe.title}
                onChange={e => setRecipe(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Bolo de Cenoura"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-chef-red focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Aula / Categoria</label>
              <input
                type="text"
                value={recipe.lesson_name}
                onChange={e => setRecipe(prev => ({ ...prev, lesson_name: e.target.value }))}
                placeholder="Ex: Confeitaria Básica"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-chef-red focus:border-transparent outline-none"
              />
            </div>
          </div>
        </section>

        {/* Ingredients */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Utensils className="w-5 h-5 text-chef-red" />
              Ingredientes
            </h2>
            <button
              onClick={handleAddSection}
              className="text-sm font-medium text-chef-red hover:text-red-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Adicionar Seção
            </button>
          </div>

          {recipe.ingredients.map((section, sIdx) => (
            <div key={sIdx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <input
                  type="text"
                  value={section.sectionName}
                  onChange={e => {
                    const newSections = [...recipe.ingredients];
                    newSections[sIdx].sectionName = e.target.value;
                    setRecipe(prev => ({ ...prev, ingredients: newSections }));
                  }}
                  placeholder="Nome da Seção (ex: Massa, Cobertura)"
                  className="flex-1 font-bold text-lg border-b border-transparent focus:border-chef-red outline-none py-1"
                />
                {recipe.ingredients.length > 1 && (
                  <button onClick={() => handleRemoveSection(sIdx)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {section.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={item.qty}
                      onChange={e => {
                        const newSections = [...recipe.ingredients];
                        newSections[sIdx].items[iIdx].qty = e.target.value;
                        setRecipe(prev => ({ ...prev, ingredients: newSections }));
                      }}
                      placeholder="Qtd"
                      className="w-20 px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50 focus:bg-white outline-none text-sm"
                    />
                    <input
                      type="text"
                      value={item.unit}
                      onChange={e => {
                        const newSections = [...recipe.ingredients];
                        newSections[sIdx].items[iIdx].unit = e.target.value;
                        setRecipe(prev => ({ ...prev, ingredients: newSections }));
                      }}
                      placeholder="Unid"
                      className="w-20 px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50 focus:bg-white outline-none text-sm"
                    />
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => {
                        const newSections = [...recipe.ingredients];
                        newSections[sIdx].items[iIdx].name = e.target.value;
                        setRecipe(prev => ({ ...prev, ingredients: newSections }));
                      }}
                      placeholder="Ingrediente"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50 focus:bg-white outline-none text-sm"
                    />
                    <button 
                      onClick={() => handleRemoveIngredient(sIdx, iIdx)}
                      className="text-gray-300 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => handleAddIngredient(sIdx)}
                  className="text-xs font-medium text-gray-400 hover:text-chef-red flex items-center gap-1 mt-2"
                >
                  <Plus className="w-3 h-3" /> Adicionar Item
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* Steps */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-chef-red" />
              Modo de Preparo
            </h2>
            <button
              onClick={handleAddStep}
              className="text-sm font-medium text-chef-red hover:text-red-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Adicionar Passo
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            {recipe.steps.map((step, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-500">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <textarea
                    value={step}
                    onChange={e => {
                      const newSteps = [...recipe.steps];
                      newSteps[idx] = e.target.value;
                      setRecipe(prev => ({ ...prev, steps: newSteps }));
                    }}
                    placeholder={`Passo ${idx + 1}...`}
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg border border-gray-100 bg-gray-50 focus:bg-white outline-none text-sm resize-none"
                  />
                </div>
                <button 
                  onClick={() => handleRemoveStep(idx)}
                  className="text-gray-300 hover:text-red-500 mt-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
