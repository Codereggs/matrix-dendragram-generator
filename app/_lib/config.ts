// Configuración para conexiones con el backend

interface Config {
  apiUrl: string;
  endpoints: {
    generateCharts: string;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const config: Config = {
  apiUrl: API_URL,
  endpoints: {
    generateCharts: `${API_URL}/generate-charts`,
  },
};

export default config;
