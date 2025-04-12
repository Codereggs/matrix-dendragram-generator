import * as ExcelJS from "exceljs";

// Columnas requeridas para el análisis
const REQUIRED_COLUMNS = [
  "participant",
  "login entry",
  "card index",
  "card label",
  "category label",
  "complete",
  "comment",
  "start time (UTC)",
  "finish time (UTC)",
  "sorted position",
];

/**
 * Verifica que un archivo Excel tenga las columnas requeridas y que cada columna tenga al menos un valor.
 *
 * @param file Archivo Excel a verificar
 * @returns Un objeto con el resultado de la verificación
 */
export async function verifyExcelColumns(file: File): Promise<{
  isValid: boolean;
  error?: string;
  missingColumns?: string[];
  emptyColumns?: string[];
}> {
  try {
    // Convertir File a ArrayBuffer para ExcelJS
    const buffer = await file.arrayBuffer();

    // Cargar el workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // Obtener la primera hoja
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        isValid: false,
        error: "El archivo Excel no contiene hojas de trabajo.",
      };
    }

    // Obtener encabezados (primera fila)
    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell) => {
      if (cell.value) {
        headers.push(cell.value.toString().trim().toLowerCase());
      }
    });

    // Verificar columnas requeridas
    const missingColumns = REQUIRED_COLUMNS.filter(
      (col) => !headers.includes(col.toLowerCase())
    );

    if (missingColumns.length > 0) {
      return {
        isValid: false,
        error: `Faltan columnas requeridas en el archivo Excel.`,
        missingColumns,
      };
    }

    // Verificar que cada columna tenga al menos un valor
    const emptyColumns: string[] = [];

    // Para cada columna requerida, verificar si tiene al menos un valor (excluyendo la primera fila)
    for (const column of REQUIRED_COLUMNS) {
      // Encontrar el índice de la columna
      const columnIndex =
        headers.findIndex((h) => h.toLowerCase() === column.toLowerCase()) + 1;

      if (columnIndex > 0) {
        let hasValue = false;
        // Revisar filas a partir de la segunda (índice 2)
        for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
          const cell = worksheet.getCell(rowIndex, columnIndex);
          if (
            cell.value !== null &&
            cell.value !== undefined &&
            cell.value !== ""
          ) {
            hasValue = true;
            break;
          }
        }

        if (!hasValue) {
          emptyColumns.push(column);
        }
      }
    }

    if (emptyColumns.length > 0) {
      return {
        isValid: false,
        error: "Algunas columnas requeridas no tienen datos.",
        emptyColumns,
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error("Error al verificar las columnas del archivo Excel:", error);
    return {
      isValid: false,
      error:
        "Error al leer el archivo Excel. Verifique que sea un archivo válido.",
    };
  }
}
