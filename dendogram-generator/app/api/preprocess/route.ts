import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid"; // Necesitarás instalar este paquete

export async function POST(request: Request): Promise<Response> {
  console.log("Route handler de preprocess iniciado");
  try {
    // Leer el cuerpo de la solicitud
    const requestBody = await request.text();

    // Crear un ID único para este proceso
    const requestId = uuidv4();
    const tempDir = path.join(process.cwd(), "tmp");

    // Asegurarse de que existe el directorio temporal
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Guardar temporalmente la solicitud en un archivo
    const requestFile = path.join(tempDir, `request_${requestId}.json`);
    const responseFile = path.join(tempDir, `response_${requestId}.json`);

    // Crear un objeto de solicitud simulado para la función handler de Python
    const requestObj = {
      body: requestBody,
    };

    fs.writeFileSync(requestFile, JSON.stringify(requestObj));

    // Construir la ruta al script Python
    const pythonScriptPath = path.join(
      process.cwd(),
      "api",
      "preprocess",
      "index.py"
    );

    // Verificar si el script existe
    if (!fs.existsSync(pythonScriptPath)) {
      console.error(`Archivo no encontrado: ${pythonScriptPath}`);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "server_error",
            message: "API no encontrada",
          },
        },
        { status: 404 }
      );
    }

    // Ejecutar el script Python
    return new Promise((resolve) => {
      const cmd = `python -c "
import json
import sys
import os
sys.path.append('${path.dirname(pythonScriptPath)}')
from index import handler

# Cargar la solicitud desde un archivo
with open('${requestFile}', 'r') as f:
    request = json.load(f)

# Llamar al controlador
response = handler(request)

# Guardar la respuesta en un archivo
with open('${responseFile}', 'w') as f:
    json.dump(response, f)

# Imprimir el ID para confirmar finalización
print('${requestId}')
"`;

      exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
        // Limpiar después
        const cleanup = () => {
          try {
            if (fs.existsSync(requestFile)) {
              fs.unlinkSync(requestFile);
            }
            if (fs.existsSync(responseFile)) {
              fs.unlinkSync(responseFile);
            }
          } catch (cleanError) {
            console.error("Error al limpiar archivos temporales:", cleanError);
          }
        };

        if (error) {
          console.error(`Error ejecutando Python: ${error.message}`);
          console.error(`Error: ${stderr}`);
          cleanup();
          resolve(
            NextResponse.json(
              {
                success: false,
                error: {
                  code: "server_error",
                  message: "Error en la ejecución del script Python",
                  details: error.message,
                },
              },
              { status: 500 }
            )
          );
          return;
        }

        try {
          // Verificar si la respuesta existe
          if (!fs.existsSync(responseFile)) {
            throw new Error("El archivo de respuesta no fue generado");
          }

          // Leer la respuesta
          const responseContent = fs.readFileSync(responseFile, "utf-8");
          const response = JSON.parse(responseContent);
          const { statusCode, body } = response;

          // Parsear el cuerpo de la respuesta si es una cadena JSON
          let parsedBody;
          try {
            parsedBody = JSON.parse(body);
          } catch {
            parsedBody = body;
          }

          // Limpiar
          cleanup();

          // Devolver la respuesta
          resolve(NextResponse.json(parsedBody, { status: statusCode }));
        } catch (jsonError) {
          console.error(`Error al procesar la respuesta: ${jsonError}`);
          cleanup();
          resolve(
            NextResponse.json(
              {
                success: false,
                error: {
                  code: "server_error",
                  message: "Error al procesar la respuesta",
                  details:
                    jsonError instanceof Error
                      ? jsonError.message
                      : String(jsonError),
                },
              },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (error) {
    console.error(`Error en el route handler de preprocess: ${error}`);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "server_error",
          message: "Error interno del servidor",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}
