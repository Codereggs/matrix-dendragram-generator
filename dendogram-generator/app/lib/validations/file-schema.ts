import { z } from "zod";

// Define el esquema de validación para archivos
export const fileSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "El archivo debe ser menor a 5MB",
    })
    .refine(
      (file) => {
        const allowedTypes = [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ];
        return allowedTypes.includes(file.type);
      },
      {
        message: "Solo se permiten archivos Excel (.xlsx)",
      }
    ),
});

export type FileInput = z.infer<typeof fileSchema>;
