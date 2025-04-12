import * as ExcelJS from "exceljs";
import { fileTypeFromBuffer } from "file-type";

/**
 * Interfaz para el resultado de la verificación de seguridad
 */
export interface SecurityCheckResult {
  isSecure: boolean;
  reason?: string;
}

/**
 * Verifica el tipo de archivo MIME real
 *
 * @param file Archivo a verificar
 * @returns Resultado de la verificación
 */
export async function verifyFileType(file: File): Promise<SecurityCheckResult> {
  try {
    // Convertir el archivo a ArrayBuffer
    const buffer = await file.arrayBuffer();

    // Intentar determinar el tipo de archivo real
    const fileType = await fileTypeFromBuffer(Buffer.from(buffer));

    // Si no se puede determinar el tipo, es sospechoso
    if (!fileType) {
      return {
        isSecure: false,
        reason: "No se pudo determinar el tipo real del archivo",
      };
    }

    // Verificar que sea realmente un archivo Excel
    const expectedTypes = ["xlsx", "xls"]; // Tipos MIME esperados para Excel
    if (!expectedTypes.includes(fileType.ext)) {
      return {
        isSecure: false,
        reason: `El archivo tiene una extensión falsa. Tipo real detectado: ${fileType.mime}`,
      };
    }

    return { isSecure: true };
  } catch (error) {
    console.error("Error al verificar el tipo de archivo:", error);
    return {
      isSecure: false,
      reason: "Error al verificar el tipo de archivo",
    };
  }
}

/**
 * Lista de funciones de Excel potencialmente peligrosas
 */
const DANGEROUS_EXCEL_FUNCTIONS = [
  "=CMD(",
  "=EXEC(",
  "=SHELL(",
  "=HYPERLINK(",
  "=DDE(",
  "=DDEAUTO(",
  "=CALL(",
  "IMPORTXML",
  "WEBSERVICE",
  // Funciones adicionales peligrosas
  "=SYSTEM(",
  "=RUN(",
  "=OSC(",
  "=REGISTER(",
  "VBA.",
  "CALL(",
  "=XLM.",
];

/**
 * Verifica si un archivo Excel contiene contenido potencialmente malicioso
 *
 * @param file El archivo a verificar
 * @returns Resultado de la verificación
 */
export async function checkExcelSecurity(
  file: File
): Promise<SecurityCheckResult> {
  try {
    // Primero verificar el tipo real del archivo
    const typeCheck = await verifyFileType(file);
    if (!typeCheck.isSecure) {
      return typeCheck;
    }

    // Convertir File a ArrayBuffer para ExcelJS
    const buffer = await file.arrayBuffer();

    // Cargar el workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // Verificar fórmulas potencialmente maliciosas en todas las hojas
    for (const worksheet of workbook.worksheets) {
      // Revisar cada celda con fórmula
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          if (cell.formula) {
            // Comprobar si contiene funciones peligrosas
            for (const func of DANGEROUS_EXCEL_FUNCTIONS) {
              if (cell.formula.toUpperCase().includes(func.toUpperCase())) {
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

    // Verificar si hay demasiadas hojas (posible señal de un archivo malicioso)
    if (workbook.worksheets.length > 100) {
      return {
        isSecure: false,
        reason: "El archivo contiene un número sospechosamente alto de hojas",
      };
    }

    // Verificar si hay demasiadas celdas (posible ataque DoS)
    let totalCells = 0;
    for (const worksheet of workbook.worksheets) {
      // Contar celdas con datos
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        totalCells += row.cellCount;
      });

      // Si hay demasiadas celdas, rechazar
      if (totalCells > 1000000) {
        // 1 millón de celdas es mucho
        return {
          isSecure: false,
          reason:
            "El archivo contiene demasiadas celdas, lo que podría causar problemas de rendimiento",
        };
      }
    }

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

/**
 * Verificación de seguridad completa para archivos Excel
 *
 * @param file Archivo a verificar
 * @returns Resultado de la verificación
 */
export async function performFullSecurityCheck(
  file: File
): Promise<SecurityCheckResult> {
  try {
    // Verificar tipo de archivo
    const typeCheck = await verifyFileType(file);
    if (!typeCheck.isSecure) {
      return typeCheck;
    }

    // Verificar contenido peligroso en Excel
    const excelCheck = await checkExcelSecurity(file);
    if (!excelCheck.isSecure) {
      return excelCheck;
    }

    // Todo está bien
    return { isSecure: true };
  } catch (error) {
    console.error("Error durante la verificación de seguridad:", error);
    return {
      isSecure: false,
      reason: "Error durante la verificación de seguridad",
    };
  }
}
