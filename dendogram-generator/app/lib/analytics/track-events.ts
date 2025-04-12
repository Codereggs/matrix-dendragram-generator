/**
 * Utilidades para el seguimiento de eventos de usuario
 */

import { track } from "@vercel/analytics";

type ActionEventType =
  | "file_upload"
  | "file_processing"
  | "file_validation_error"
  | "view_results"
  | "download_image"
  | "page_view"
  | "error";

/**
 * Registra un evento de acción del usuario
 *
 * @param eventType Tipo de evento
 * @param properties Propiedades adicionales del evento
 */
export function trackEvent(
  eventType: ActionEventType,
  properties?: Record<string, string | number | boolean | null>
) {
  // Registrar el evento en Vercel Analytics
  track(eventType, properties);

  // En desarrollo, mostrar en consola
  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics] Event: ${eventType}`, properties);
  }
}

/**
 * Utilidades específicas para eventos comunes
 */

// Seguimiento de carga de archivos
export function trackFileUpload(fileType: string, fileSize: number) {
  trackEvent("file_upload", {
    file_type: fileType,
    file_size: fileSize,
  });
}

// Seguimiento de procesamiento de archivos
export function trackFileProcessing(successful: boolean, timeMs?: number) {
  trackEvent("file_processing", {
    successful,
    time_ms: timeMs || null,
  });
}

// Seguimiento de errores
export function trackError(errorCode: string, errorMessage: string) {
  trackEvent("error", {
    error_code: errorCode,
    error_message: errorMessage,
  });
}

// Seguimiento de visualización de resultados
export function trackResultsView() {
  trackEvent("view_results");
}

// Seguimiento de descarga de imágenes
export function trackImageDownload(imageType: string) {
  trackEvent("download_image", {
    image_type: imageType,
  });
}
