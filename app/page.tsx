import Image from "next/image";
import FileUploader from "./_components/FileUploader";
import InstructionsModal from "@/app/components/InstructionsModal";

export default function Home() {
  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-8 sm:p-12 font-sans">
      <header className="text-center">
        <h1 className="text-3xl font-bold mb-2">
          Generador de Dendrogramas y Matriz de similitud
        </h1>
        <p className="text-gray-600 mb-6">
          Sube un archivo Excel para generar dendrogramas y matrices
        </p>
      </header>

      <main className="w-full max-w-xl">
        <FileUploader />
      </main>

      <footer className="text-center text-gray-500 text-sm mt-8">
        <p>
          Herramienta para análisis de datos. Sube archivos Excel (.xlsx) para
          procesamiento. Made with ❤️ by{" "}
          <a href="https://codereggs.tech" rel="noopener" target="_blank">
            Codereggs
          </a>
        </p>
        <div className="flex justify-center pt-4">
          <a
            href="https://cafecito.app/codereggs"
            rel="noopener"
            target="_blank"
          >
            <Image
              src="https://cdn.cafecito.app/imgs/buttons/button_1.png"
              alt="Invitame un café en cafecito.app"
              width={200}
              height={200}
            />
          </a>
        </div>
      </footer>
      {/* Modal de instrucciones */}
      <InstructionsModal />
    </div>
  );
}
