"use client";

import { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import WebVitalsTracker from "./WebVitalsTracker";

interface AnalyticsProviderProps {
  children?: ReactNode;
}

/**
 * Proveedor que agrupa todas las soluciones de análisis
 * Se debe añadir una vez en el layout principal
 */
export default function AnalyticsProvider({
  children,
}: AnalyticsProviderProps) {
  return (
    <>
      {children}
      {/* Vercel Analytics */}
      <Analytics />
      {/* Web Vitals Tracker */}
      <WebVitalsTracker />
    </>
  );
}
