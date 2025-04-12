"use client";

import { useEffect } from "react";
import { initWebVitals } from "@/app/_lib/analytics/web-vitals";

/**
 * Componente para inicializar el seguimiento de Web Vitals
 * Se debe añadir una vez en el layout principal
 */
export default function WebVitalsTracker() {
  useEffect(() => {
    // Inicializar el seguimiento de Web Vitals
    initWebVitals();
  }, []);

  // Este componente no renderiza nada
  return null;
}
