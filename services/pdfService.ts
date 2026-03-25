// This service relies on pdfjsLib being loaded globally via script tag in index.html

const waitForPdfLib = async (timeoutMs = 10000): Promise<any> => {
  const win = window as any;
  if (win.pdfjsLib) return win.pdfjsLib;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (win.pdfjsLib) {
        clearInterval(interval);
        resolve(win.pdfjsLib);
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        reject(new Error("Timeout waiting for PDF.js library to load"));
      }
    }, 100);
  });
};

export const extractTextFromPdf = async (file: File): Promise<string[]> => {
  // Timeout helper to prevent infinite hanging
  const withTimeout = <T>(promise: Promise<T>, ms: number, msg: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(msg)), ms);
      promise.then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  };

  return new Promise(async (resolve, reject) => {
    try {
        // Wait for library to be available
        const pdfjsLib = await waitForPdfLib();
        
        // Ensure worker is set
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        const fileReader = new FileReader();
        
        fileReader.onload = async function() {
          if (!this.result) {
            reject(new Error("Erro ao ler o arquivo."));
            return;
          }
          
          const typedarray = new Uint8Array(this.result as ArrayBuffer);
    
          try {
            const loadingTask = pdfjsLib.getDocument(typedarray);
            
            // Wrap document loading in timeout (15s)
            const pdf = await withTimeout<any>(
                loadingTask.promise, 
                15000, 
                "O processamento do PDF demorou muito. O arquivo pode estar corrompido ou protegido."
            );
            
            const pagePromises = Array.from({ length: pdf.numPages }, async (_, i) => {
              const pageNum = i + 1;
              // Wrap page rendering in timeout (5s per page)
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
                reject(new Error("O PDF parece vazio ou não contém texto selecionável (imagens digitalizadas)."));
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

    } catch (e) {
        reject(new Error("Biblioteca PDF.js não carregada. Por favor, verifique sua conexão e recarregue a página."));
    }
  });
};