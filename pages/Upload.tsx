import React, { useState, useRef } from 'react';
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, Loader2, ArrowRight, X, Plus } from 'lucide-react';
import { extractTextFromPdf } from '../services/pdfService';
import { parseRecipesFromPages } from '../services/geminiService';
import { saveRecipes } from '../services/supabaseService';
import { Recipe } from '../types';
import { useNavigate } from 'react-router-dom';

export const Upload: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [extractedCount, setExtractedCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter((f: File) => f.type === 'application/pdf');
      
      if (newFiles.length === 0) {
        setError("Por favor, selecione apenas arquivos PDF.");
        return;
      }

      setFiles(prev => [...prev, ...newFiles]);
      setError(null);
      setExtractedCount(0);
    }
    // Reset input so same files can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setStatus('Iniciando...');
    
    const allRecipes: Recipe[] = [];
    let hasError = false;

    try {
      // Sequential processing
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePrefix = files.length > 1 ? `[Arquivo ${i + 1}/${files.length}] ` : '';

        try {
          // 1. Extract Text
          setStatus(`${filePrefix}Extraindo texto do PDF...`);
          const pages = await extractTextFromPdf(file);
          
          if (!pages || pages.length === 0) {
            console.warn(`Skipping ${file.name}: No text extracted.`);
            continue;
          }

          // Validation: Check if pages actually contain text
          const totalTextLength = pages.reduce((acc, page) => acc + page.length, 0);
          // 50 chars is an arbitrary low number to detect essentially empty files (headers only)
          if (totalTextLength < 50) {
            throw new Error(`O arquivo ${file.name} parece ser uma imagem digitalizada ou está vazio. Este app requer PDFs com texto selecionável.`);
          }

          // 2. AI Parsing with progress callback
          const recipes = await parseRecipesFromPages(pages, (msg) => {
            setStatus(`${filePrefix}${msg}`);
          });
          
          if (recipes.length > 0) {
            allRecipes.push(...recipes);
          } else {
             console.log(`No recipes found in ${file.name}`);
          }
          
        } catch (innerErr: any) {
          console.error(`Error processing file ${file.name}:`, innerErr);
          if (innerErr.message?.includes("imagem digitalizada")) {
            throw innerErr;
          }
          hasError = true;
        }
      }

      if (allRecipes.length === 0) {
        if (hasError) {
             throw new Error("Falha ao processar arquivos. A IA pode estar indisponível ou encontrou um erro, tente novamente.");
        }
        // If no error was thrown but no recipes found, it means the text was processed but AI found nothing.
        throw new Error("Não foram encontradas receitas. Verifique se o conteúdo do PDF é legível.");
      }

      setExtractedCount(allRecipes.length);
      
      // 3. Save to DB
      setStatus(`Salvando ${allRecipes.length} receitas...`);
      await saveRecipes(allRecipes);
      
      setStatus('Concluído!');
      setIsProcessing(false);
      
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Ocorreu um erro inesperado.";
      
      if (msg.includes("API_KEY") || msg.includes("API Key")) {
        setError("Erro de Configuração: API KEY não encontrada. Verifique as variáveis de ambiente.");
      } else if (msg.includes("429") || msg.includes("quota")) {
        setError("Limite da API atingido. Aguarde alguns instantes e tente novamente.");
      } else {
        setError(msg);
      }
      
      setIsProcessing(false);
      setStatus('');
    }
  };

  return (
    <div className="max-w-3xl mx-auto min-h-[70vh] flex flex-col justify-center">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-serif font-bold text-gray-900 mb-3">Adicionar Receitas</h1>
        <p className="text-gray-500 text-lg">Envie um ou mais PDFs. O Gemini AI irá extrair e organizar tudo automaticamente.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-12">
        {files.length === 0 ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-chef-red hover:bg-red-50/30 transition-all group"
          >
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <UploadIcon className="w-10 h-10 text-gray-400 group-hover:text-chef-red" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">Clique para selecionar PDFs</h3>
            <p className="text-gray-400 text-sm">Suporta seleção múltipla</p>
            <input 
              type="file" 
              accept=".pdf" 
              multiple
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* File List */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{animationDelay: `${idx * 50}ms`}}>
                  <div className="flex items-center overflow-hidden">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                      <FileText className="text-chef-red w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  {!isProcessing && (
                    <button 
                      onClick={() => removeFile(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Actions Area */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
               {!isProcessing && !extractedCount && (
                 <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm font-medium text-chef-red hover:text-red-700 flex items-center gap-1"
                 >
                   <Plus className="w-4 h-4" /> Adicionar mais
                 </button>
               )}
               
               {!isProcessing && !extractedCount && (
                 <p className="text-sm text-gray-400">
                   {files.length} arquivo{files.length !== 1 && 's'} selecionado{files.length !== 1 && 's'}
                 </p>
               )}
            </div>
            
            <input 
              type="file" 
              accept=".pdf" 
              multiple
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange}
            />

            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {isProcessing ? (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                  <span className="animate-pulse">{status}</span>
                  <Loader2 className="w-4 h-4 animate-spin text-chef-red" />
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-chef-red animate-pulse rounded-full w-full"></div>
                </div>
              </div>
            ) : extractedCount > 0 ? (
               <div className="bg-green-50 text-green-800 p-6 rounded-lg text-center">
                 <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                   <CheckCircle className="w-8 h-8" />
                 </div>
                 <h3 className="text-lg font-bold mb-2">Sucesso!</h3>
                 <p>Total de {extractedCount} receitas extraídas. Redirecionando...</p>
               </div>
            ) : (
              <button 
                onClick={processFiles}
                className="w-full bg-chef-dark text-white py-4 rounded-xl font-bold text-lg hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
              >
                Processar {files.length} Arquivo{files.length !== 1 && 's'} <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};