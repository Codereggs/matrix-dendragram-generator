"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { z } from "zod";
import { fileSchema } from "../lib/validations/file-schema";
import { checkExcelSecurity } from "../lib/utils/file-security";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Alert } from "./ui/alert";
import { Toaster, toast } from "react-hot-toast";
import { ErrorCode, getErrorMessage } from "../lib/errors/error-codes";
import { ApiErrorResponse, ApiResponse } from "../lib/errors/api-error";

interface ProcessingResult {
  success: boolean;
  message: string;
  images?: {
    matriz_completa?: string;
    matriz_escalera?: string;
    dendrograma?: string;
  };
}

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

      // Crear FormData para enviar el archivo
      const formData = new FormData();
      formData.append("file", file);

      // Enviar al endpoint
      setProgress(50);
      const response = await fetch("/api/process-excel", {
        method: "POST",
        body: formData,
      });

      setProgress(80);

      const data = (await response.json()) as ApiResponse<{
        matriz_completa: string;
        matriz_escalera: string;
        dendrograma: string;
      }>;

      if (!response.ok || !data.success) {
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
        images: {
          matriz_completa: data.data.matriz_completa,
          matriz_escalera: data.data.matriz_escalera,
          dendrograma: data.data.dendrograma,
        },
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
      {processingResult && !error && (
        <div className="mt-6 space-y-6">
          <Alert variant="success" className="mt-4">
            {processingResult.message}
          </Alert>

          {processingResult.images && (
            <div className="space-y-8">
              <h2 className="text-xl font-semibold text-center">
                Resultados del Análisis
              </h2>

              {/* Imágenes generadas */}
              {processingResult.images.matriz_completa && (
                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-3">
                    Matriz de Similitud
                  </h3>
                  <div className="relative w-full h-[400px] sm:h-[500px]">
                    <img
                      src={processingResult.images.matriz_completa}
                      alt="Matriz de Similitud"
                      className="w-full object-contain"
                      style={{ maxHeight: "500px" }}
                    />
                  </div>
                </div>
              )}

              {processingResult.images.matriz_escalera && (
                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-3">
                    Matriz de Similitud (Tipo Escalera)
                  </h3>
                  <div className="relative w-full h-[400px] sm:h-[500px]">
                    <img
                      src={processingResult.images.matriz_escalera}
                      alt="Matriz de Similitud (Escalera)"
                      className="w-full object-contain"
                      style={{ maxHeight: "500px" }}
                    />
                  </div>
                </div>
              )}

              {processingResult.images.dendrograma && (
                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-3">
                    Dendrograma de Análisis
                  </h3>
                  <div className="relative w-full h-[400px] sm:h-[500px]">
                    <img
                      src={processingResult.images.dendrograma}
                      alt="Dendrograma"
                      className="w-full object-contain"
                      style={{ maxHeight: "500px" }}
                    />
                  </div>
                </div>
              )}

              <div className="text-center">
                <p className="text-sm text-gray-600 mt-4">
                  Puedes guardar las imágenes haciendo clic derecho sobre ellas.
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
