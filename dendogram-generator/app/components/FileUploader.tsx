"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { z } from "zod";
import { fileSchema } from "../lib/validations/file-schema";
import { checkExcelSecurity } from "../lib/utils/file-security";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Alert } from "./ui/alert";
import { Toaster, toast } from "react-hot-toast";
import { ErrorCode, getErrorMessage } from "../lib/errors/error-codes";
import { ApiErrorResponse } from "../lib/errors/api-error";

interface ProcessingResult {
  success: boolean;
  message: string;
  data?: {
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
  };
}

// Componente para el heatmap
const HeatmapCanvas = ({
  data,
  width,
  height,
}: {
  data: number[][];
  width: number;
  height: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cellWidth = width / data.length;
    const cellHeight = height / data.length;

    // Limpiar el canvas
    ctx.clearRect(0, 0, width, height);

    // Dibujar cada celda
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data[i].length; j++) {
        const value = data[i][j];

        // Valor entre 0 y 1 para la intensidad del color azul
        const intensity = value;

        // Color azul con intensidad variable
        const blue = Math.floor(255 * (1 - intensity));
        ctx.fillStyle = `rgb(${blue}, ${blue}, 255)`;

        // Dibujar el rectángulo
        ctx.fillRect(j * cellWidth, i * cellHeight, cellWidth, cellHeight);
      }
    }

    // Dibujar bordes
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0, 0, width, height);
  }, [data, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "auto" }}
    />
  );
};

// Componente para el dendrograma
const DendrogramCanvas = ({
  icoord,
  dcoord,
  width,
  height,
}: {
  icoord: number[][];
  dcoord: number[][];
  width: number;
  height: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Limpiar el canvas
    ctx.clearRect(0, 0, width, height);

    // Normalizar coordenadas para que se ajusten al canvas
    const flatIcoord = icoord.flat();
    const flatDcoord = dcoord.flat();

    const minX = Math.min(...flatIcoord);
    const maxX = Math.max(...flatIcoord);
    const minY = Math.min(...flatDcoord);
    const maxY = Math.max(...flatDcoord);

    const scaleX = (width - 40) / (maxX - minX);
    const scaleY = (height - 40) / (maxY - minY);

    // Dibujar líneas
    ctx.beginPath();
    ctx.strokeStyle = "#636efa";
    ctx.lineWidth = 2;

    for (let i = 0; i < icoord.length; i++) {
      const x1 = (icoord[i][0] - minX) * scaleX + 20;
      const y1 = height - ((dcoord[i][0] - minY) * scaleY + 20);

      ctx.moveTo(x1, y1);

      for (let j = 1; j < icoord[i].length; j++) {
        const x = (icoord[i][j] - minX) * scaleX + 20;
        const y = height - ((dcoord[i][j] - minY) * scaleY + 20);
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Dibujar ejes
    ctx.beginPath();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.moveTo(20, height - 20);
    ctx.lineTo(width - 20, height - 20);
    ctx.stroke();

    // Título del eje Y
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Distancia", 0, 0);
    ctx.restore();
  }, [icoord, dcoord, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "auto" }}
    />
  );
};

export default function FileUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  const [errorDetails, setErrorDetails] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [processingResult, setProcessingResult] =
    useState<ProcessingResult | null>(null);
  const [isVercelEnvironment, setIsVercelEnvironment] = useState(false);

  // Detectar si estamos en Vercel
  useEffect(() => {
    // Verificar la URL para saber si estamos en Vercel o localhost
    const isVercel = window.location.hostname.includes("vercel.app");
    setIsVercelEnvironment(isVercel);
  }, []);

  // Función para mostrar mensajes de error
  const showErrorToast = (code: ErrorCode, message: string) => {
    toast.error(message, {
      id: code, // Usar el código como ID para evitar duplicados
      duration: 5000, // Duración más larga para errores
    });
  };

  // Manejar el cambio de archivos
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Resetear estados
    setError(null);
    setErrorCode(null);
    setErrorDetails(null);
    setProcessingResult(null);
    setProgress(0);

    if (acceptedFiles.length === 0) {
      return;
    }

    const selectedFile = acceptedFiles[0];

    try {
      // Validar tipo de archivo y tamaño con Zod
      fileSchema.parse({ file: selectedFile });

      // Si pasa la validación, actualizar estado
      setFile(selectedFile);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errorMessage = err.errors[0].message;
        setError(errorMessage);

        // Determinar el tipo de error para mostrar un toast adecuado
        if (errorMessage.includes("tamaño")) {
          showErrorToast(ErrorCode.FILE_SIZE_EXCEEDED, errorMessage);
        } else if (errorMessage.includes("tipo")) {
          showErrorToast(ErrorCode.FILE_TYPE_INVALID, errorMessage);
        } else {
          showErrorToast(ErrorCode.UNKNOWN_ERROR, errorMessage);
        }
      } else {
        const errorMessage =
          "Error al cargar el archivo. Por favor intente de nuevo.";
        setError(errorMessage);
        showErrorToast(ErrorCode.UNKNOWN_ERROR, errorMessage);
      }
      setFile(null);
    }
  }, []);

  // Configuración de react-dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    maxFiles: 1,
    multiple: false,
  });

  // Procesar el archivo
  const handleProcess = async () => {
    if (!file) {
      const errorMessage = getErrorMessage(ErrorCode.FILE_NOT_PROVIDED);
      setError(errorMessage);
      setErrorCode(ErrorCode.FILE_NOT_PROVIDED);
      showErrorToast(ErrorCode.FILE_NOT_PROVIDED, errorMessage);
      return;
    }

    try {
      setIsLoading(true);
      setProgress(10);
      setError(null);
      setErrorCode(null);
      setErrorDetails(null);

      // Verificar seguridad del archivo localmente antes de enviarlo
      const securityResult = await checkExcelSecurity(file);
      setProgress(30);

      if (!securityResult.isSecure) {
        const code = ErrorCode.FILE_INSECURE;
        const errorMessage = getErrorMessage(code);
        setError(
          errorMessage +
            (securityResult.reason ? ` - ${securityResult.reason}` : "")
        );
        setErrorCode(code);
        showErrorToast(code, errorMessage);
        setIsLoading(false);
        setProgress(0);
        return;
      }

      // Codificar el archivo a base64
      const fileBase64 = await readFileAsBase64(file);

      // Enviar al endpoint como JSON
      setProgress(50);
      const response = await fetch("/api/process-excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileBase64 }),
      });

      setProgress(80);

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        // Manejar respuesta de error
        const errorResponse = data as ApiErrorResponse;
        const errorCode = errorResponse.error.code;
        const errorMessage = errorResponse.error.message;
        const errorDetails = errorResponse.error.details;

        setError(errorMessage);
        setErrorCode(errorCode);
        setErrorDetails(errorDetails || null);

        showErrorToast(errorCode, errorMessage);
        throw new Error(errorMessage);
      }

      setProgress(100);
      setProcessingResult({
        success: true,
        message: data.message || "Archivo procesado correctamente.",
        data: data.data,
      });
      toast.success("¡Archivo procesado con éxito!");
    } catch (err) {
      console.error("Error al procesar el archivo:", err);

      // Si no se ha establecido un error específico, mostrar error genérico
      if (!errorCode) {
        const genericErrorCode = ErrorCode.UNKNOWN_ERROR;
        const genericErrorMessage = getErrorMessage(genericErrorCode);
        setError(genericErrorMessage);
        setErrorCode(genericErrorCode);
        showErrorToast(genericErrorCode, genericErrorMessage);
      }
    } finally {
      setIsLoading(false);
      // Resetear la barra de progreso después de un tiempo si hubo error
      if (error) {
        setTimeout(() => setProgress(0), 3000);
      }
    }
  };

  // Función para convertir archivo a base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          // Remover el prefijo "data:application/..." de la cadena base64
          const base64String = reader.result.split(",")[1];
          resolve(base64String);
        } else {
          reject(new Error("No se pudo leer el archivo como string"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  // Renderizar detalles adicionales del error si existen
  const renderErrorDetails = () => {
    if (!errorDetails) return null;

    if (
      errorCode === ErrorCode.MISSING_COLUMNS &&
      errorDetails.missingColumns
    ) {
      const columns = errorDetails.missingColumns as string[];
      return (
        <div className="mt-2 text-sm">
          <p className="font-semibold">Columnas faltantes:</p>
          <ul className="list-disc list-inside">
            {columns.map((col) => (
              <li key={col}>{col}</li>
            ))}
          </ul>
        </div>
      );
    }

    if (errorCode === ErrorCode.EMPTY_COLUMNS && errorDetails.emptyColumns) {
      const columns = errorDetails.emptyColumns as string[];
      return (
        <div className="mt-2 text-sm">
          <p className="font-semibold">Columnas sin datos:</p>
          <ul className="list-disc list-inside">
            {columns.map((col) => (
              <li key={col}>{col}</li>
            ))}
          </ul>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Toaster position="top-center" />

      {/* Aviso de limitación en Vercel */}
      {isVercelEnvironment && (
        <Alert variant="info" className="mb-6">
          <div className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <strong>Entorno serverless:</strong>
          </div>
          <p className="mt-1">
            Estás usando la aplicación en un entorno serverless. El
            procesamiento puede tardar más tiempo que en una instalación local.
            Para archivos grandes, considera ejecutar la aplicación localmente
            para un mejor rendimiento.
          </p>
        </Alert>
      )}

      {/* Área para arrastrar archivos */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
      >
        <input {...getInputProps()} />
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <p className="mt-2 text-sm text-gray-600">
          {isDragActive
            ? "Suelta el archivo aquí..."
            : "Arrastra y suelta un archivo Excel (.xlsx), o haz clic para seleccionarlo"}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          El archivo debe contener las columnas requeridas para el análisis.
          Tamaño máximo: 5MB.
        </p>
      </div>

      {/* Mostrar archivo seleccionado */}
      {file && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-sm font-medium text-gray-900">
            Archivo seleccionado:
          </p>
          <p className="text-sm text-gray-500">
            {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </p>
        </div>
      )}

      {/* Barra de progreso */}
      {progress > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-1">
            {progress < 100 ? "Procesando..." : "¡Completado!"}
          </p>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <Alert variant="error" className="mt-4">
          {error}
          {renderErrorDetails()}
        </Alert>
      )}

      {/* Resultado del procesamiento */}
      {processingResult?.success && !error && (
        <div className="mt-6 space-y-6">
          <Alert variant="success" className="mt-4">
            {processingResult.message}
          </Alert>

          {processingResult.data && (
            <div className="space-y-8">
              <h2 className="text-xl font-semibold text-center">
                Resultados del Análisis
              </h2>

              {/* Matriz de Similitud */}
              {processingResult.data.heatmap && (
                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-3">
                    Matriz de Similitud (Tipo Escalera)
                  </h3>
                  <div className="w-full h-[500px]">
                    <HeatmapCanvas
                      data={processingResult.data.heatmap.z}
                      width={800}
                      height={500}
                    />
                  </div>
                </div>
              )}

              {/* Dendrograma */}
              {processingResult.data.dendrogram && (
                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-3">
                    Dendrograma de Análisis
                  </h3>
                  <div className="w-full h-[500px]">
                    <DendrogramCanvas
                      icoord={processingResult.data.dendrogram.icoord}
                      dcoord={processingResult.data.dendrogram.dcoord}
                      width={800}
                      height={500}
                    />
                  </div>
                </div>
              )}

              {/* Metadata y enlaces */}
              {processingResult.data.metadata?.id_url_mapping && (
                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-3">
                    URLs de los elementos analizados
                  </h3>
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            URL
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(
                          processingResult.data.metadata.id_url_mapping
                        ).map(([id, url]) => (
                          <tr key={id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-500">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {url}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="text-center">
                <p className="text-sm text-gray-600 mt-4">
                  Las visualizaciones son interactivas. Puedes hacer zoom,
                  desplazarte y descargarlas.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botón de procesamiento */}
      <div className="mt-6">
        <Button
          type="button"
          onClick={handleProcess}
          isLoading={isLoading}
          disabled={!file || isLoading}
          className="w-full"
        >
          Procesar Archivo
        </Button>
      </div>
    </div>
  );
}
