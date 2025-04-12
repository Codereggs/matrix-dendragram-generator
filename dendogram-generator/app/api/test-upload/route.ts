import { NextRequest, NextResponse } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  ApiResponse,
} from "@/app/lib/errors/api-error";
import { ErrorCode } from "@/app/lib/errors/error-codes";

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ success: boolean }>>> {
  try {
    // Verificar si la solicitud tiene contenido multipart
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.FILE_NOT_PROVIDED,
          "No se proporcionó ningún archivo"
        ),
        { status: 400 }
      );
    }

    // Imprimir información sobre el archivo
    console.log("Archivo recibido:");
    console.log("Nombre:", file.name);
    console.log("Tipo:", file.type);
    console.log("Tamaño:", file.size, "bytes");

    // Endpoint de prueba - aceptamos cualquier archivo sin validación exhaustiva
    return NextResponse.json(
      createSuccessResponse(
        { success: true },
        "Archivo de prueba recibido correctamente"
      )
    );
  } catch (error) {
    console.error("Error en el endpoint de prueba:", error);

    return NextResponse.json(
      createErrorResponse(
        ErrorCode.SERVER_ERROR,
        "Error interno del servidor",
        { error: error instanceof Error ? error.message : String(error) }
      ),
      { status: 500 }
    );
  }
}

// Configuración para aceptar archivos grandes
export const config = {
  api: {
    bodyParser: false,
  },
};
