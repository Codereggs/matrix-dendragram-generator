"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "../_components/ui/button";

// Icono de libro abierto (reemplaza a Lucide React BookOpen)
const BookOpenIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
  </svg>
);

const InstructionsModal = () => {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          className="cursor-pointer fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors duration-200"
          aria-label="Instrucciones"
        >
          <BookOpenIcon />
          <span>Instrucciones</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-overlayShow" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[85vh] w-[90vw] max-w-3xl rounded-lg bg-white p-6 shadow-xl z-50 overflow-y-auto data-[state=open]:animate-contentShow">
          <Dialog.Title className="text-2xl font-bold text-gray-900 mb-4">
            Instrucciones de Uso
          </Dialog.Title>

          <div className="prose prose-slate max-w-none">
            <p className="text-gray-700 mb-4">
              Esta app está hecha para ayudar a los estudiantes de UX a
              conseguir su dendrograma y matriz de similitud sin abonar tanta
              plata. Utilizando técnicas programáticas que puedan ayudarles.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mt-6 mb-2">
              Cómo conseguir los datos necesarios
            </h3>

            <ol className="list-decimal pl-6 space-y-2 mb-4 text-gray-700">
              <li>
                Acceder a la página de{" "}
                <a
                  href="https://app.optimalworkshop.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  OptimalWorkshop
                </a>
              </li>
              <li>Registrarse y elaborar su card sorting</li>
              <li>
                Después de tener los resultados con al menos 2 participantes,
                descargar el archivo &quot;raw file&quot; (archivo de datos sin
                procesar ver. uncut){" "}
                <a
                  href="https://drive.google.com/file/d/1tDOTDomEGyc3jglHOEG5Im__kAiwh9QP/view?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  Ver ejemplo
                </a>
              </li>
            </ol>

            <p className="text-gray-700 mb-4">
              Mientras se suba un archivo Excel similar al obtenido del ejemplo,
              se podrá elaborar la matriz de similitud y el dendrograma con
              facilidad, evitando tener que pagar herramientas costosas.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mt-6 mb-2">
              Pasos para usar la herramienta
            </h3>

            <ol className="list-decimal pl-6 space-y-2  text-gray-700">
              <li>Arrastre o haga clic para subir su archivo Excel (.xlsx)</li>
              <li>Presione el botón &quot;Procesar Archivo&quot;</li>
              <li>
                Espere mientras se procesa el archivo (puede tardar unos
                segundos)
              </li>
              <li>¡Listo! Visualice su dendrograma y matriz de similitud</li>
              <li>
                Puede guardar las imágenes generadas haciendo clic derecho sobre
                ellas
              </li>
            </ol>
          </div>

          <div className="mt-6 flex justify-end">
            <Dialog.Close asChild>
              <Button
                type="button"
                className="cursor-pointer inline-flex items-center justify-center px-4 py-2 font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Entendido
              </Button>
            </Dialog.Close>
          </div>

          <Dialog.Close asChild>
            <button
              className="cursor-pointer absolute top-4 right-4 inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Cerrar"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default InstructionsModal;
