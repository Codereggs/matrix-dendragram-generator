import { Metric } from "web-vitals";

/**
 * Reporta métricas Web Vitals a la consola y a sistemas de análisis
 *
 * @param metric Métrica de Web Vitals a reportar
 */
export function reportWebVitals(metric: Metric) {
  // En modo desarrollo, mostramos en consola
  if (process.env.NODE_ENV === "development") {
    console.log(`Web Vitals: ${metric.name}`, metric);
  }

  // Enviamos la métrica a cualquier sistema de análisis
  // Para Vercel Analytics, estas métricas se envían automáticamente
  // Solo necesitamos implementar esta función si queremos enviarlas
  // a sistemas adicionales de análisis

  // Ejemplo:
  // Si quisiéramos enviar a una API personalizada:
  // fetch('/api/analytics', {
  //   method: 'POST',
  //   body: JSON.stringify({
  //     metric: metric.name,
  //     value: metric.value,
  //     id: metric.id,
  //     navigationType: metric.navigationType
  //   })
  // });
}

/**
 * Inicializa el seguimiento de Web Vitals
 */
export async function initWebVitals() {
  if (typeof window !== "undefined") {
    // Importar web-vitals dinámicamente
    const { onCLS, onFID, onLCP, onTTFB } = await import("web-vitals");

    // Registrar cada métrica
    onCLS(reportWebVitals);
    onFID(reportWebVitals);
    onLCP(reportWebVitals);
    onTTFB(reportWebVitals);
  }
}
