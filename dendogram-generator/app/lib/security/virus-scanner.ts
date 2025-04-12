import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";

import clamav from "clamav.js";

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdtempAsync = promisify(fs.mkdtemp);

// Crear una declaración de módulo para clamav.js
declare module "clamav.js" {
  export function createScanner(options: {
    host?: string;
    port?: number;
    timeout?: number;
  }): ClamAvScanner;
}

interface ClamAvScanner {
  scan(
    filePath: string,
    callback: (err: Error | null, object: unknown, virus: string | null) => void
  ): void;
}

/**
 * Opciones de configuración para el escáner de virus
 */
interface VirusScannerOptions {
  host?: string;
  port?: number;
  timeout?: number;
}

/**
 * Resultado del escaneo de virus
 */
interface VirusScanResult {
  isClean: boolean;
  virusName?: string;
  error?: string;
}

/**
 * Clase para escanear archivos en busca de virus
 */
export class VirusScanner {
  private scanner: ClamAvScanner;
  private isInitialized: boolean = false;

  constructor(options: VirusScannerOptions = {}) {
    // Configuración por defecto para ClamAV
    const defaultOptions = {
      host: options.host || "127.0.0.1",
      port: options.port || 3310,
      timeout: options.timeout || 60000,
    };

    // Crear el escáner de ClamAV
    this.scanner = clamav.createScanner(defaultOptions);
  }

  /**
   * Inicializa el escáner
   */
  public async initialize(): Promise<boolean> {
    try {
      // El escáner ya está listo para usar en esta implementación
      this.isInitialized = true;
      return true;
    } catch (error: unknown) {
      console.error("Error al inicializar el escáner de virus:", error);
      return false;
    }
  }

  /**
   * Escanea un archivo en busca de virus
   *
   * @param file Archivo a escanear
   * @returns Resultado del escaneo
   */
  public async scanFile(file: File): Promise<VirusScanResult> {
    if (!this.isInitialized) {
      try {
        await this.initialize();
      } catch {
        return {
          isClean: false,
          error: "No se pudo inicializar el escáner de virus",
        };
      }
    }

    try {
      // Crear un directorio temporal
      const tempDir = await mkdtempAsync(path.join(os.tmpdir(), "virus-scan-"));
      const tempFilePath = path.join(tempDir, file.name);

      // Convertir File a ArrayBuffer y luego a Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Escribir el archivo en el directorio temporal
      await writeFileAsync(tempFilePath, buffer);

      return new Promise((resolve) => {
        // Escanear el archivo usando el scanner
        this.scanner.scan(
          tempFilePath,
          (err: Error | null, _object: unknown, virus: string | null) => {
            // Limpiar el archivo temporal
            unlinkAsync(tempFilePath).catch(console.error);

            if (err) {
              resolve({
                isClean: false,
                error: `Error al escanear: ${err.message || String(err)}`,
              });
              return;
            }

            if (virus) {
              resolve({
                isClean: false,
                virusName: virus,
              });
            } else {
              resolve({
                isClean: true,
              });
            }
          }
        );
      });
    } catch (error: unknown) {
      console.error("Error durante el escaneo de virus:", error);
      return {
        isClean: false,
        error: `Error durante el escaneo: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Verifica si ClamAV está disponible
   * Esta función es útil para verificar si el servicio está funcionando antes de intentar escanear
   *
   * @returns true si ClamAV está disponible, false en caso contrario
   */
  public async isAvailable(): Promise<boolean> {
    try {
      // Podríamos hacer una verificación más real aquí si tenemos un endpoint de ping en ClamAV
      // Pero por simplicidad, asumimos que está disponible si se inicializó correctamente
      return this.isInitialized;
    } catch (error: unknown) {
      console.error("Error al verificar disponibilidad del escáner:", error);
      return false;
    }
  }
}

// Exportar una instancia por defecto
export const defaultVirusScanner = new VirusScanner();
