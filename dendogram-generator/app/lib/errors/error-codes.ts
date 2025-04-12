// Enum para los códigos de error (slugs)
export const ErrorCode = {
  // Errores de archivo
  FILE_NOT_PROVIDED: "file_not_provided",
  FILE_TYPE_INVALID: "file_type_invalid",
  FILE_SIZE_EXCEEDED: "file_size_exceeded",
  FILE_INSECURE: "file_insecure",
  FILE_PARSING_ERROR: "file_parsing_error",

  // Errores de estructura de datos
  MISSING_COLUMNS: "missing_columns",
  EMPTY_COLUMNS: "empty_columns",

  // Errores de procesamiento
  PYTHON_EXECUTION_ERROR: "python_execution_error",
  IMAGES_GENERATION_ERROR: "images_generation_error",

  // Errores generales
  SERVER_ERROR: "server_error",
  UNKNOWN_ERROR: "unknown_error",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// Mapeo entre códigos de error y mensajes amigables para el usuario
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Errores de archivo
  [ErrorCode.FILE_NOT_PROVIDED]:
    "No se ha proporcionado ningún archivo. Por favor, selecciona un archivo Excel para procesarlo.",
  [ErrorCode.FILE_TYPE_INVALID]:
    "El formato de archivo no es válido. Por favor, sube un archivo Excel (.xlsx).",
  [ErrorCode.FILE_SIZE_EXCEEDED]:
    "El archivo excede el tamaño máximo permitido de 5MB. Por favor, reduce su tamaño.",
  [ErrorCode.FILE_INSECURE]:
    "El archivo contiene elementos potencialmente inseguros (como macros o fórmulas no permitidas).",
  [ErrorCode.FILE_PARSING_ERROR]:
    "No se pudo leer el archivo Excel. Asegúrate de que no esté dañado y tenga el formato correcto.",

  // Errores de estructura de datos
  [ErrorCode.MISSING_COLUMNS]:
    "El archivo no contiene todas las columnas requeridas para el análisis.",
  [ErrorCode.EMPTY_COLUMNS]:
    "Algunas columnas requeridas no tienen datos. Todas las columnas deben contener al menos un valor.",

  // Errores de procesamiento
  [ErrorCode.PYTHON_EXECUTION_ERROR]:
    "Error al ejecutar el análisis de datos. El procesamiento Python falló.",
  [ErrorCode.IMAGES_GENERATION_ERROR]:
    "No se pudieron generar las imágenes de análisis.",

  // Errores generales
  [ErrorCode.SERVER_ERROR]:
    "Error en el servidor. Por favor, inténtalo de nuevo más tarde.",
  [ErrorCode.UNKNOWN_ERROR]:
    "Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo más tarde.",
};

// Función para obtener un mensaje de error amigable a partir de un código de error
export function getErrorMessage(code: ErrorCode, details?: string): string {
  const baseMessage =
    ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];

  if (details) {
    return `${baseMessage} Detalles: ${details}`;
  }

  return baseMessage;
}
