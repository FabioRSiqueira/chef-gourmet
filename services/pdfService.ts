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
        const pages: string[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Simple text extraction - joining items with space
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          // Add page number marker to help AI context
          pages.push(`--- PAGE ${i} ---\n${pageText}`);
        }

        resolve(pages);
      } catch (error) {
        reject(error);
      }
    };

    fileReader.onerror = reject;
    fileReader.readAsArrayBuffer(file);
  });
};