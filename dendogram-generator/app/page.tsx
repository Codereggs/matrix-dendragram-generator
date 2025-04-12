import FileUploader from "./components/FileUploader";

export default function Home() {
  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-8 sm:p-12 font-sans">
      <header className="text-center">
        <h1 className="text-3xl font-bold mb-2">Generador de Dendogramas</h1>
        <p className="text-gray-600 mb-6">
          Sube un archivo Excel para generar dendogramas y matrices
        </p>
      </header>

      <main className="w-full max-w-xl">
        <FileUploader />
      </main>

      <footer className="text-center text-gray-500 text-sm mt-8">
        <p>
          Herramienta para análisis de datos. Sube archivos Excel (.xlsx) para
          procesamiento.
        </p>
      </footer>
    </div>
  );
}
