import { NextRequest, NextResponse } from "next/server";
import { verifyExcelColumns } from "@/app/lib/process-excel/verify-excel";
import { runPythonScript } from "@/app/lib/process-excel/run-python-script";
import { performFullSecurityCheck } from "@/app/lib/security/file-security";
import { ErrorCode, getErrorMessage } from "@/app/lib/errors/error-codes";
import {
  createErrorResponse,
  createSuccessResponse,
  ApiResponse,
} from "@/app/lib/errors/api-error";

interface ProcessResult {
  matriz_completa: string;
  matriz_escalera: string;
  dendrograma: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<ProcessResult>>> {
  try {
    // Verificar si la solicitud tiene contenido multipart
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
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
      let errorCode = ErrorCode.FILE_PARSING_ERROR;
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

    // Convertir el archivo a Buffer para procesarlo con el script Python
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ejecutar el script Python
    const result = await runPythonScript(buffer);

    if (result.error) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.PYTHON_EXECUTION_ERROR,
          getErrorMessage(ErrorCode.PYTHON_EXECUTION_ERROR),
          { details: result.error }
        ),
        { status: 500 }
      );
    }

    // Verificar que todas las imágenes se generaron correctamente
    if (
      !result.matriz_completa ||
      !result.matriz_escalera ||
      !result.dendrograma
    ) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.IMAGES_GENERATION_ERROR,
          getErrorMessage(ErrorCode.IMAGES_GENERATION_ERROR)
        ),
        { status: 500 }
      );
    }

    // Devolver las imágenes en base64
    return NextResponse.json(
      createSuccessResponse<ProcessResult>(
        {
          matriz_completa: result.matriz_completa,
          matriz_escalera: result.matriz_escalera,
          dendrograma: result.dendrograma,
        },
        "Archivo procesado correctamente"
      )
    );
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
