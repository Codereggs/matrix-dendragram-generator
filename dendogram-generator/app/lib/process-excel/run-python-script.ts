import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { promisify } from "util";

const execAsync = promisify(exec);
const mkdtempAsync = promisify(fs.mkdtemp);
const writeFileAsync = promisify(fs.writeFile);

interface PythonScriptResult {
  matriz_escalera?: string;
  dendrograma?: string;
  error?: string;
  details?: string;
}

/**
 * Ejecuta el script Python para generar los gráficos a partir de un archivo Excel
 *
 * @param file El archivo Excel a procesar
 * @returns Un objeto con las imágenes generadas en formato base64
 */
export async function runPythonScript(
  file: Buffer
): Promise<PythonScriptResult> {
  try {
    // Crear un directorio temporal para los archivos
    const tempDir = await mkdtempAsync(
      path.join(os.tmpdir(), "excel-process-")
    );
    const tempFilePath = path.join(tempDir, "data.xlsx");

    // Escribir el archivo en el directorio temporal
    await writeFileAsync(tempFilePath, file);

    // Verificar si estamos en Vercel
    const isVercel = process.env.VERCEL === "1";

    if (isVercel) {
      // En Vercel, notificamos que esta funcionalidad no está disponible directamente
      console.log(
        "Ejecutando en entorno Vercel - El procesamiento Python no está disponible directamente"
      );

      return {
        error: "El procesamiento Python no se puede ejecutar en este entorno",
        details:
          "Esta funcionalidad no está disponible en el entorno de producción. Por favor, use la aplicación localmente o implemente un servicio externo para el procesamiento de Python.",
      };
    } else {
      // Enfoque local: ejecutar el script Python directamente
      // Obtener la ruta del script Python (relativa al directorio del proyecto)
      const scriptPath = path.resolve(process.cwd(), "py_chart_generator.py");

      console.log("Ejecutando script Python:", scriptPath);
      console.log("Archivo de entrada:", tempFilePath);
      console.log("Directorio de salida:", tempDir);

      try {
        // Escapar las rutas para manejar espacios y caracteres especiales
        const escapedScriptPath = `"${scriptPath}"`;
        const escapedTempFilePath = `"${tempFilePath}"`;
        const escapedTempDir = `"${tempDir}"`;

        // Detectar si estamos en un entorno Linux (probable en Vercel)
        const isLinux = os.platform() === "linux";

        // Configurar el comando Python basado en el entorno
        const pythonCommand = isLinux ? "python3" : "python3";

        // Ejecutar el script Python con un timeout más largo (3 minutos)
        const { stdout, stderr } = await execAsync(
          `${pythonCommand} ${escapedScriptPath} ${escapedTempFilePath} ${escapedTempDir}`,
          { timeout: 180000 }
        );

        // Verificamos si hay mensajes de error en la salida
        if (stderr) {
          // Separamos los errores de las advertencias (UserWarning son comunes en matplotlib y no son críticos)
          const isRealError =
            stderr.includes("ERROR:") ||
            stderr.includes("ERROR INESPERADO:") ||
            stderr.includes("ERROR CRÍTICO:") ||
            stderr.includes("ERROR GENERAL:") ||
            (!stderr.includes("UserWarning") && stderr.length > 0);

          if (isRealError) {
            console.error("Error desde Python:", stderr);

            // Intentar extraer el mensaje de error específico
            const errorMatch = stderr.match(/ERROR:?\s*(.*)/);
            const errorMessage = errorMatch
              ? errorMatch[1]
              : "Error al ejecutar el script Python.";

            return {
              error: errorMessage,
              details: stderr,
            };
          } else {
            // Solo son advertencias, podemos continuar
            console.log("Advertencias desde Python (no críticas):", stderr);
          }
        }

        console.log("Salida de Python:", stdout);

        // Leer las imágenes generadas
        const matrixStairPath = path.join(
          tempDir,
          "matriz_similitud_escalera.png"
        );
        const dendrogramPath = path.join(
          tempDir,
          "dendrograma_card_sorting.png"
        );

        const matrixStairExists = fs.existsSync(matrixStairPath);
        const dendrogramExists = fs.existsSync(dendrogramPath);

        // Verificar si se generaron todas las imágenes
        if (!matrixStairExists || !dendrogramExists) {
          console.error("No se generaron todas las imágenes esperadas:");
          console.error(`matriz_escalera: ${matrixStairExists}`);
          console.error(`dendrograma: ${dendrogramExists}`);
          return {
            error: "No se generaron todas las imágenes.",
            details: `Archivos generados: matriz_escalera: ${matrixStairExists}, dendrograma: ${dendrogramExists}`,
          };
        }

        // Convertir las imágenes a base64
        const matrixStairBase64 = fs
          .readFileSync(matrixStairPath)
          .toString("base64");
        const dendrogramBase64 = fs
          .readFileSync(dendrogramPath)
          .toString("base64");

        // Limpieza: eliminar archivos temporales
        try {
          fs.unlinkSync(tempFilePath);
          fs.unlinkSync(matrixStairPath);
          fs.unlinkSync(dendrogramPath);
          fs.rmdirSync(tempDir);
        } catch (cleanupError) {
          console.warn("Error al limpiar archivos temporales:", cleanupError);
        }

        return {
          matriz_escalera: `data:image/png;base64,${matrixStairBase64}`,
          dendrograma: `data:image/png;base64,${dendrogramBase64}`,
        };
      } catch (execError: unknown) {
        // Error específico de la ejecución del comando
        console.error("Error al ejecutar el comando Python:", execError);

        // Extraer información más detallada del error
        const errorDetails =
          execError instanceof Error
            ? execError.message
            : typeof execError === "object" && execError !== null
            ? JSON.stringify(execError)
            : String(execError);

        const timeout = errorDetails.includes("timeout");

        if (timeout) {
          return {
            error: "La ejecución del script Python tomó demasiado tiempo.",
            details: errorDetails,
          };
        }

        return {
          error: "Error al ejecutar el script Python.",
          details: errorDetails,
        };
      }
    }
  } catch (error) {
    console.error("Error general al procesar el archivo:", error);
    return {
      error: "Error al procesar el archivo.",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}
