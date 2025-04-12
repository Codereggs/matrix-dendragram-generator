import { ErrorCode } from "./error-codes";

// Interfaz para respuestas de error en el API
export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Interfaz para respuestas exitosas en el API
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

// Tipo combinado que puede ser una respuesta exitosa o de error
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Función para crear una respuesta de error estandarizada
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

// Función para crear una respuesta exitosa estandarizada
export function createSuccessResponse<T>(
  data: T,
  message?: string
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}
