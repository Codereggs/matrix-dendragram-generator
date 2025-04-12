import * as ExcelJS from "exceljs";

/**
 * Verifica si un archivo Excel contiene contenido potencialmente malicioso.
 *
 * @param file El archivo a verificar
 * @returns Un objeto con el resultado de la verificación
 */
export async function checkExcelSecurity(file: File): Promise<{
  isSecure: boolean;
  reason?: string;
}> {
  try {
    // Convertir File a ArrayBuffer para ExcelJS
    const buffer = await file.arrayBuffer();

    // Cargar el workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // Verificar fórmulas potencialmente maliciosas en todas las hojas
    const dangerousFunctions = [
      "=CMD(",
      "=EXEC(",
      "=SHELL(",
      "=HYPERLINK(",
      "=DDE(",
      "=DDEAUTO(",
      "=CALL(",
      "IMPORTXML",
      "WEBSERVICE",
    ];

    for (const worksheet of workbook.worksheets) {
      // Revisar cada celda con fórmula
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          if (cell.formula) {
            // Comprobar si contiene funciones peligrosas
            for (const func of dangerousFunctions) {
              if (cell.formula.toUpperCase().includes(func)) {
                return {
                  isSecure: false,
                  reason: `Fórmula potencialmente maliciosa detectada: ${func}`,
                };
              }
            }
          }
        });
      });
    }

    // ExcelJS no tiene un método nativo para verificar macros,
    // pero podríamos intentar detectarlas de otras formas si se necesita
    // Por ahora, asumimos que el archivo es seguro si no tiene fórmulas maliciosas

    return { isSecure: true };
  } catch (error) {
    console.error("Error verificando la seguridad del archivo:", error);
    return {
      isSecure: false,
      reason:
        "Error al verificar el archivo. Por favor, asegúrese de que es un archivo Excel válido.",
    };
  }
}
