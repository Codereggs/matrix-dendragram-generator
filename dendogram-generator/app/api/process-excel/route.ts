import { NextRequest, NextResponse } from "next/server";
import { verifyExcelColumns } from "@/app/lib/process-excel/verify-excel";
import { runPythonScript } from "@/app/lib/process-excel/run-python-script";
import { checkExcelSecurity } from "@/app/lib/utils/file-security";

export async function POST(request: NextRequest) {
  try {
    // Verificar si la solicitud tiene contenido multipart
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se ha proporcionado ningún archivo" },
        { status: 400 }
      );
    }

    // Verificar tipo de archivo
    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "El archivo debe ser de tipo Excel (.xlsx)" },
        { status: 400 }
      );
    }

    // Verificar tamaño del archivo (límite de 5MB)
    const fiveMB = 5 * 1024 * 1024;
    if (file.size > fiveMB) {
      return NextResponse.json(
        { error: "El archivo no debe superar los 5MB" },
        { status: 400 }
      );
    }

    // Verificar seguridad del archivo
    const securityResult = await checkExcelSecurity(file);
    if (!securityResult.isSecure) {
      return NextResponse.json(
        { error: `Archivo inseguro: ${securityResult.reason}` },
        { status: 400 }
      );
    }

    // Verificar columnas requeridas
    const columnVerification = await verifyExcelColumns(file);
    if (!columnVerification.isValid) {
      let errorMessage =
        columnVerification.error || "Formato de archivo inválido";

      if (
        columnVerification.missingColumns &&
        columnVerification.missingColumns.length > 0
      ) {
        errorMessage += ` Columnas faltantes: ${columnVerification.missingColumns.join(
          ", "
        )}`;
      }

      if (
        columnVerification.emptyColumns &&
        columnVerification.emptyColumns.length > 0
      ) {
        errorMessage += ` Columnas sin datos: ${columnVerification.emptyColumns.join(
          ", "
        )}`;
      }

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Convertir el archivo a Buffer para procesarlo con el script Python
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ejecutar el script Python
    const result = await runPythonScript(buffer);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Devolver las imágenes en base64
    return NextResponse.json({
      success: true,
      message: "Archivo procesado correctamente",
      images: {
        matriz_completa: result.matriz_completa,
        matriz_escalera: result.matriz_escalera,
        dendrograma: result.dendrograma,
      },
    });
  } catch (error) {
    console.error("Error procesando archivo Excel:", error);
    return NextResponse.json(
      { error: "Error al procesar el archivo" },
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
