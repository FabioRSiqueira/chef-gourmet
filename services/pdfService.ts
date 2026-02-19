// This service relies on pdfjsLib being loaded globally via script tag in index.html

export const extractTextFromPdf = async (file: File): Promise<string[]> => {
  // Timeout helper to prevent infinite hanging if the worker fails silently
  const withTimeout = <T>(promise: Promise<T>, ms: number, msg: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(msg)), ms);
      promise.then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  };

  return new Promise((resolve, reject) => {
    // Safety check for Global PDF.js
    // @ts-ignore
    if (typeof window.pdfjsLib === 'undefined') {
      reject(new Error("Biblioteca PDF.js não carregada. Recarregue a página e tente novamente."));
      return;
    }

    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(this.result as ArrayBuffer);

      try {
        // @ts-ignore
        const loadingTask = window.pdfjsLib.getDocument(typedarray);
        
        // Wrap document loading in timeout (10s)
        // Fix: Cast generic to any to resolve property access on unknown type
        const pdf = await withTimeout<any>(
            loadingTask.promise, 
            10000, 
            "Timeout ao carregar documento PDF. O arquivo pode estar corrompido."
        );
        
        const pagePromises = Array.from({ length: pdf.numPages }, async (_, i) => {
          const pageNum = i + 1;
          // Wrap page rendering in timeout (5s per page)
          // Fix: Cast generic to any to resolve property access on unknown type
          const page = await withTimeout<any>(
              pdf.getPage(pageNum),
              5000,
              `Erro ao ler página ${pageNum}`
          );
          
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str + (item.hasEOL ? '\n' : '  '))
            .join('');

          return `--- PAGE ${pageNum} ---\n${pageText}`;
        });

        const pages = await Promise.all(pagePromises);

        if (pages.length === 0) {
            reject(new Error("O PDF parece vazio."));
            return;
        }

        resolve(pages);
      } catch (error) {
        console.error("PDF Parsing Error:", error);
        reject(error);
      }
    };

    fileReader.onerror = () => reject(new Error("Falha ao ler o arquivo localmente."));
    fileReader.readAsArrayBuffer(file);
  });
};