import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export const extractTextFromCsv = async (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.warn("CSV Parsing warnings:", results.errors);
        }
        
        // Convert rows to a readable string format
        const text = results.data
          .map((row: any) => {
            if (Array.isArray(row)) {
              return row.join(' | '); // Use pipe as separator for clarity
            }
            return String(row);
          })
          .join('\n');
          
        resolve([`--- CSV FILE: ${file.name} ---\n${text}`]);
      },
      error: (error) => {
        reject(new Error(`Erro ao ler CSV: ${error.message}`));
      },
      header: false, // We want raw data to pass to LLM
      skipEmptyLines: true
    });
  });
};

export const extractTextFromExcel = async (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Falha ao ler arquivo Excel"));
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const sheets: string[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          // Convert sheet to CSV format as it's token-efficient and readable by LLMs
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          
          if (csv.trim().length > 0) {
            sheets.push(`--- SHEET: ${sheetName} ---\n${csv}`);
          }
        });

        if (sheets.length === 0) {
          reject(new Error("O arquivo Excel parece vazio."));
          return;
        }

        resolve(sheets);
      } catch (error: any) {
        reject(new Error(`Erro ao processar Excel: ${error.message}`));
      }
    };

    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
};
