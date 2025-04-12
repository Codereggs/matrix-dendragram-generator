// Configuración para conexiones con el backend

interface Config {
  apiUrl: string;
  endpoints: {
    preprocess: string;
    analyze: string;
  };
}

// URL base del backend de Python - cambiar en producción
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const config: Config = {
  apiUrl: API_URL,
  endpoints: {
    preprocess: `${API_URL}/api/preprocess`,
    analyze: `${API_URL}/api/analyze`,
  },
};

export default config;
