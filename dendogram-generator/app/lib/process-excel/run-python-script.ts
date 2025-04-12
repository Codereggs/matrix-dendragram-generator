import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { promisify } from "util";

const execAsync = promisify(exec);
const mkdtempAsync = promisify(fs.mkdtemp);
const writeFileAsync = promisify(fs.writeFile);

interface PythonScriptResult {
  matriz_completa?: string;
  matriz_escalera?: string;
  dendrograma?: string;
  error?: string;
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

    // Obtener la ruta del script Python (relativa al directorio del proyecto)
    const scriptPath = path.resolve(process.cwd(), "py_chart_generator.py");

    // Ejecutar el script Python
    const { stdout, stderr } = await execAsync(
      `python ${scriptPath} "${tempFilePath}" "${tempDir}"`
    );

    // Verificamos si hay mensajes de error en la salida
    if (stderr) {
      // Separamos los errores de las advertencias (UserWarning son comunes en matplotlib y no son críticos)
      const isRealError =
        stderr.includes("ERROR:") ||
        stderr.includes("ERROR INESPERADO:") ||
        stderr.includes("ERROR CRÍTICO:") ||
        (!stderr.includes("UserWarning") && stderr.length > 0);

      if (isRealError) {
        console.error("Error desde Python:", stderr);

        // Intentar extraer el mensaje de error específico
        const errorMatch = stderr.match(/ERROR:?\s*(.*)/);
        const errorMessage = errorMatch
          ? errorMatch[1]
          : "Error al ejecutar el script Python.";

        return { error: errorMessage };
      } else {
        // Solo son advertencias, podemos continuar
        console.log("Advertencias desde Python (no críticas):", stderr);
      }
    }

    console.log("Salida de Python:", stdout);

    // Leer las imágenes generadas
    const matrixFullPath = path.join(tempDir, "matriz_similitud_completa.png");
    const matrixStairPath = path.join(tempDir, "matriz_similitud_escalera.png");
    const dendrogramPath = path.join(tempDir, "dendrograma_card_sorting.png");

    const matrixFullExists = fs.existsSync(matrixFullPath);
    const matrixStairExists = fs.existsSync(matrixStairPath);
    const dendrogramExists = fs.existsSync(dendrogramPath);

    if (!matrixFullExists || !matrixStairExists || !dendrogramExists) {
      return { error: "No se generaron todas las imágenes." };
    }

    // Convertir las imágenes a base64
    const matrixFullBase64 = fs.readFileSync(matrixFullPath).toString("base64");
    const matrixStairBase64 = fs
      .readFileSync(matrixStairPath)
      .toString("base64");
    const dendrogramBase64 = fs.readFileSync(dendrogramPath).toString("base64");

    // Limpieza: eliminar archivos temporales
    try {
      fs.unlinkSync(tempFilePath);
      fs.unlinkSync(matrixFullPath);
      fs.unlinkSync(matrixStairPath);
      fs.unlinkSync(dendrogramPath);
      fs.rmdirSync(tempDir);
    } catch (cleanupError) {
      console.warn("Error al limpiar archivos temporales:", cleanupError);
    }

    return {
      matriz_completa: `data:image/png;base64,${matrixFullBase64}`,
      matriz_escalera: `data:image/png;base64,${matrixStairBase64}`,
      dendrograma: `data:image/png;base64,${dendrogramBase64}`,
    };
  } catch (error) {
    console.error("Error al ejecutar el script Python:", error);
    return { error: "Error al procesar el archivo." };
  }
}
