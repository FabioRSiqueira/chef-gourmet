// This service relies on pdfjsLib being loaded globally via script tag in index.html
// to avoid complex build configurations for web workers in this environment.

export const extractTextFromPdf = async (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(this.result as ArrayBuffer);

      try {
        // @ts-ignore - pdfjsLib is global from CDN
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        
        // Create an array of promises to extract text from ALL pages in parallel
        const pagePromises = Array.from({ length: pdf.numPages }, async (_, i) => {
          const pageNum = i + 1;
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Enhanced text extraction to preserve some structure
          // Join with newline if the item has EOL flag, otherwise space
          const pageText = textContent.items
            .map((item: any) => item.str + (item.hasEOL ? '\n' : ' '))
            .join('');

          return `--- PAGE ${pageNum} ---\n${pageText}`;
        });

        // Wait for all pages to be extracted simultaneously
        const pages = await Promise.all(pagePromises);

        resolve(pages);
      } catch (error) {
        reject(error);
      }
    };

    fileReader.onerror = reject;
    fileReader.readAsArrayBuffer(file);
  });
};