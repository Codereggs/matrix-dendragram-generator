import { NextRequest, NextResponse } from "next/server";
import { verifyExcelColumns } from "@/app/lib/process-excel/verify-excel";
import { performFullSecurityCheck } from "@/app/lib/security/file-security";
import { ErrorCode, getErrorMessage } from "@/app/lib/errors/error-codes";
import {
  createErrorResponse,
  createSuccessResponse,
  ApiResponse,
} from "@/app/lib/errors/api-error";

interface ProcessResult {
  matriz_escalera?: string;
  dendrograma?: string;
  heatmap?: {
    z: number[][];
    ids: string[];
  };
  dendrogram?: {
    ivl: string[];
    dcoord: number[][];
    icoord: number[][];
    color_list?: string[];
  };
  metadata?: {
    id_url_mapping: Record<string, string>;
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<ProcessResult>>> {
  try {
    // Verificar si estamos en modo de prueba
    const testMode = request.nextUrl.searchParams.has("test");

    // Verificar el tipo de contenido para determinar si es JSON o FormData
    const contentType = request.headers.get("content-type") || "";
    let file: File | null = null;
    let fileBuffer: Buffer | null = null;

    if (contentType.includes("application/json")) {
      // Procesar JSON con base64
      const jsonData = await request.json();

      if (!jsonData.fileBase64) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCode.FILE_NOT_PROVIDED,
            getErrorMessage(ErrorCode.FILE_NOT_PROVIDED)
          ),
          { status: 400 }
        );
      }

      // Decodificar el archivo base64
      try {
        const base64Data = jsonData.fileBase64;
        fileBuffer = Buffer.from(base64Data, "base64");

        // Crear un File a partir del buffer para validaciones
        file = new File([fileBuffer], "uploaded.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      } catch {
        return NextResponse.json(
          createErrorResponse(
            ErrorCode.FILE_PARSING_ERROR,
            "Error al decodificar el archivo base64"
          ),
          { status: 400 }
        );
      }
    } else if (contentType.includes("multipart/form-data")) {
      // Procesar FormData (método original)
      try {
        const formData = await request.formData();
        file = formData.get("file") as File | null;

        if (file) {
          const arrayBuffer = await file.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
        }
      } catch {
        return NextResponse.json(
          createErrorResponse(
            ErrorCode.SERVER_ERROR,
            "Error al procesar el formulario multipart"
          ),
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.SERVER_ERROR,
          "Tipo de contenido no soportado. Use 'multipart/form-data' o 'application/json'"
        ),
        { status: 400 }
      );
    }

    if (!file || !fileBuffer) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.FILE_NOT_PROVIDED,
          getErrorMessage(ErrorCode.FILE_NOT_PROVIDED)
        ),
        { status: 400 }
      );
    }

    // Verificar tipo de archivo
    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.FILE_TYPE_INVALID,
          getErrorMessage(ErrorCode.FILE_TYPE_INVALID)
        ),
        { status: 400 }
      );
    }

    // Verificar tamaño del archivo (límite de 5MB)
    const fiveMB = 5 * 1024 * 1024;
    if (file.size > fiveMB) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.FILE_SIZE_EXCEEDED,
          getErrorMessage(ErrorCode.FILE_SIZE_EXCEEDED)
        ),
        { status: 400 }
      );
    }

    // Para archivos muy pequeños o en modo de prueba, podemos saltarnos algunas validaciones
    if (!testMode && file.size > 100) {
      // Verificación de seguridad mejorada
      const securityResult = await performFullSecurityCheck(file);
      if (!securityResult.isSecure) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCode.FILE_INSECURE,
            getErrorMessage(ErrorCode.FILE_INSECURE),
            { reason: securityResult.reason }
          ),
          { status: 400 }
        );
      }

      // Verificar columnas requeridas
      const columnVerification = await verifyExcelColumns(file);
      if (!columnVerification.isValid) {
        let errorCode: ErrorCode = ErrorCode.FILE_PARSING_ERROR;
        const details: Record<string, unknown> = {};

        // Determinar el código de error específico
        if (
          columnVerification.missingColumns &&
          columnVerification.missingColumns.length > 0
        ) {
          errorCode = ErrorCode.MISSING_COLUMNS;
          details.missingColumns = columnVerification.missingColumns;
        } else if (
          columnVerification.emptyColumns &&
          columnVerification.emptyColumns.length > 0
        ) {
          errorCode = ErrorCode.EMPTY_COLUMNS;
          details.emptyColumns = columnVerification.emptyColumns;
        }

        return NextResponse.json(
          createErrorResponse(errorCode, getErrorMessage(errorCode), details),
          { status: 400 }
        );
      }
    } else {
      console.log(
        "Modo de prueba o archivo pequeño, saltando validaciones detalladas"
      );
    }

    try {
      // En Vercel, usamos funciones serverless divididas para optimizar el uso de memoria
      console.log(
        "Ejecutando en entorno Vercel - Usando funciones serverless divididas"
      );

      try {
        // Convertir el archivo a base64 para enviarlo como JSON
        const fileBase64 = fileBuffer.toString("base64");

        console.log("Iniciando fase 1: Preprocesamiento...");

        // Primera fase: Preprocesamiento
        const preprocess = await fetch("/api/preprocess", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileBase64,
          }),
        });

        if (!preprocess.ok) {
          const errorText = await preprocess.text();
          console.error("Error en la fase de preprocesamiento:", errorText);
          return NextResponse.json(
            createErrorResponse(
              ErrorCode.PYTHON_EXECUTION_ERROR,
              "Error en la fase de preprocesamiento",
              { details: errorText }
            ),
            { status: 500 }
          );
        }

        // Extraer datos preprocesados
        const preprocessResult = await preprocess.json();

        if (!preprocessResult.success) {
          console.error(
            "Error reportado en la fase de preprocesamiento:",
            preprocessResult.error
          );
          return NextResponse.json(
            createErrorResponse(
              ErrorCode.PYTHON_EXECUTION_ERROR,
              preprocessResult.error?.message ||
                "Error en el preprocesamiento de datos",
              { details: JSON.stringify(preprocessResult.error) }
            ),
            { status: 500 }
          );
        }

        console.log("Fase 1 completada. Iniciando fase 2: Análisis...");

        // Segunda fase: Análisis
        const analyze = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            descriptions: preprocessResult.data.descriptions,
            unique_ids: preprocessResult.data.unique_ids,
            id_url_mapping: preprocessResult.data.id_url_mapping,
          }),
        });

        if (!analyze.ok) {
          const errorText = await analyze.text();
          console.error("Error en la fase de análisis:", errorText);
          return NextResponse.json(
            createErrorResponse(
              ErrorCode.PYTHON_EXECUTION_ERROR,
              "Error en la fase de análisis",
              { details: errorText }
            ),
            { status: 500 }
          );
        }

        // Obtener resultado final
        const analyzeResult = await analyze.json();

        if (!analyzeResult.success) {
          console.error(
            "Error reportado en la fase de análisis:",
            analyzeResult.error
          );
          return NextResponse.json(
            createErrorResponse(
              ErrorCode.PYTHON_EXECUTION_ERROR,
              analyzeResult.error?.message || "Error en el análisis de datos",
              { details: JSON.stringify(analyzeResult.error) }
            ),
            { status: 500 }
          );
        }

        console.log("Fase 2 completada. Procesamiento exitoso.");

        // Devolver el resultado final
        return NextResponse.json(
          createSuccessResponse<ProcessResult>(
            {
              heatmap: analyzeResult.data.heatmap,
              dendrogram: analyzeResult.data.dendrogram,
              metadata: analyzeResult.data.metadata,
            },
            "Archivo procesado correctamente"
          )
        );
      } catch (error) {
        console.error("Error al procesar con funciones serverless:", error);

        // Verificar si es un error de timeout
        const isTimeout =
          error instanceof Error &&
          (error.name === "AbortError" ||
            error.message.includes("timeout") ||
            error.message.includes("aborted"));

        if (isTimeout) {
          return NextResponse.json(
            createErrorResponse(
              ErrorCode.SERVER_ERROR,
              "El procesamiento tomó demasiado tiempo",
              {
                details:
                  "La función no respondió dentro del tiempo límite. Intente con un archivo más pequeño.",
              }
            ),
            { status: 500 }
          );
        }

        return NextResponse.json(
          createErrorResponse(
            ErrorCode.SERVER_ERROR,
            "Error al procesar con funciones serverless",
            {
              details: error instanceof Error ? error.message : String(error),
            }
          ),
          { status: 500 }
        );
      }
    } catch (error) {
      console.error("Error procesando archivo Excel:", error);

      return NextResponse.json(
        createErrorResponse(
          ErrorCode.SERVER_ERROR,
          getErrorMessage(ErrorCode.SERVER_ERROR),
          { error: error instanceof Error ? error.message : String(error) }
        ),
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error procesando archivo Excel:", error);

    return NextResponse.json(
      createErrorResponse(
        ErrorCode.SERVER_ERROR,
        getErrorMessage(ErrorCode.SERVER_ERROR),
        { error: error instanceof Error ? error.message : String(error) }
      ),
      { status: 500 }
    );
  }
}

// Configuración para aceptar archivos grandes
export const config = {
  api: {
    bodyParser: false, // Evitar que Next.js analice el cuerpo de la solicitud
  },
};
