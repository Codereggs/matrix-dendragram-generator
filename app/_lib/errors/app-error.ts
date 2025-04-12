import { ErrorCode, getErrorMessage } from "./error-codes";

/**
 * Clase personalizada de error para la aplicación
 * Extiende la clase Error nativa y agrega propiedades específicas para nuestra aplicación
 */
export class AppError extends Error {
  code: ErrorCode;
  details?: Record<string, unknown>;
  statusCode: number;

  constructor(
    code: ErrorCode,
    message?: string,
    details?: Record<string, unknown>,
    statusCode = 400
  ) {
    // Si no se proporciona un mensaje, obtener el mensaje del código
    // Convertimos details a string para getErrorMessage si existe
    const detailsStr = details ? JSON.stringify(details) : undefined;
    super(message || getErrorMessage(code, detailsStr));

    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;

    // Necesario para que instanceof funcione correctamente en clases que extienden Error
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Formatea el error para respuestas de API
   */
  toApiResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }

  /**
   * Crea un error de servidor con código de estado 500
   */
  static serverError(message?: string, details?: Record<string, unknown>) {
    return new AppError(ErrorCode.SERVER_ERROR, message, details, 500);
  }

  /**
   * Crea un error de validación (normalmente para entradas de usuario incorrectas)
   */
  static validationError(
    code: ErrorCode,
    message?: string,
    details?: Record<string, unknown>
  ) {
    return new AppError(code, message, details, 400);
  }

  /**
   * Crea un error relacionado con archivos
   */
  static fileError(
    code: ErrorCode,
    message?: string,
    details?: Record<string, unknown>
  ) {
    return new AppError(code, message, details, 400);
  }
}
