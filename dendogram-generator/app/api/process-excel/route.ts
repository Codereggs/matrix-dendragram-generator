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

    console.log(`Modo de prueba: ${testMode ? "activado" : "desactivado"}`);

    // En modo de prueba, podemos devolver directamente datos simulados
    if (testMode) {
      console.log("Usando modo de prueba - Generando respuesta simulada");
      return NextResponse.json(
        createSuccessResponse<ProcessResult>(
          {
            heatmap: {
              z: [
                [1.0, 0.5, 0.3],
                [0.5, 1.0, 0.7],
                [0.3, 0.7, 1.0],
              ],
              ids: ["1", "2", "3"],
            },
            dendrogram: {
              ivl: ["1", "2", "3"],
              dcoord: [
                [0, 1, 0, 0],
                [0, 2, 0, 0],
              ],
              icoord: [
                [0, 0, 1, 1],
                [0, 0, 2, 2],
              ],
              color_list: ["blue", "red"],
            },
            metadata: {
              id_url_mapping: { "1": "url1", "2": "url2", "3": "url3" },
            },
          },
          "Datos de prueba generados correctamente"
        )
      );
    }

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

        // Si estamos en modo de prueba, imprimimos detalles adicionales
        if (testMode) {
          console.log("MODO DE PRUEBA - Detalles adicionales:");
          console.log(
            `Tamaño del archivo base64: ${fileBase64.length} caracteres`
          );
          console.log(
            `Primeros 100 caracteres: ${fileBase64.substring(0, 100)}...`
          );
        }

        console.log("Iniciando fase 1: Preprocesamiento...");

        // Determinar si estamos en desarrollo o producción
        const host = request.headers.get("host") || "";
        const protocol = host.includes("localhost") ? "http" : "https";
        const baseUrl = `${protocol}://${host}`;

        try {
          // Primera fase: Preprocesamiento
          console.log(
            `Llamando a API de preprocesamiento: ${baseUrl}/api/preprocess`
          );
          const preprocess = await fetch(`${baseUrl}/api/preprocess`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileBase64,
            }),
          });

          console.log(
            `Respuesta de la API de preprocesamiento: ${preprocess.status} ${preprocess.statusText}`
          );

          if (!preprocess.ok) {
            const errorText = await preprocess.text();
            console.error("Error en la fase de preprocesamiento:", errorText);
            console.error("Status code:", preprocess.status);
            try {
              // Intentar parsear como JSON para obtener más detalles
              const errorJson = JSON.parse(errorText);
              console.error("Detalles del error:", errorJson);
              return NextResponse.json(
                createErrorResponse(
                  ErrorCode.PYTHON_EXECUTION_ERROR,
                  "Error en la fase de preprocesamiento",
                  { details: errorJson }
                ),
                { status: 500 }
              );
            } catch {
              // Si no es JSON, usar el texto tal cual
              return NextResponse.json(
                createErrorResponse(
                  ErrorCode.PYTHON_EXECUTION_ERROR,
                  "Error en la fase de preprocesamiento",
                  { details: errorText, status: preprocess.status }
                ),
                { status: 500 }
              );
            }
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
          console.log(`Llamando a API de análisis: ${baseUrl}/api/analyze`);
          const analyze = await fetch(`${baseUrl}/api/analyze`, {
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
