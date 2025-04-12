# Generador de Dendrogramas y Matrices

Este proyecto consta de dos partes:

1. Un frontend desarrollado con Next.js
2. Un backend desarrollado con Flask

## Estructura del proyecto

```
/dendogram-generator          # Directorio raíz del proyecto
├── app/                      # Frontend Next.js
│   ├── components/           # Componentes de React
│   ├── lib/                  # Utilidades
│   └── ...
├── python-backend/           # Backend de Python con Flask
│   ├── app/                  # Código de la aplicación Flask
│   ├── requirements.txt      # Dependencias de Python
│   └── ...
└── ...
```

## Requisitos

- Node.js 18 o superior
- Python 3.9 o superior
- npm o yarn

## Instrucciones para desarrollo

### 1. Iniciar el backend de Python

```bash
# Navegar al directorio del backend
cd python-backend

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Iniciar servidor
python wsgi.py
```

El backend estará disponible en http://localhost:5000

### 2. Iniciar el frontend Next.js

En otra terminal:

```bash
# Navegar al directorio raíz
cd dendogram-generator

# Instalar dependencias
npm install
# o
yarn install

# Iniciar servidor de desarrollo
npm run dev
# o
yarn dev
```

El frontend estará disponible en http://localhost:3000

## Despliegue

### Backend (Render.com)

1. Crea un nuevo Web Service en Render
2. Conecta tu repositorio de GitHub
3. Configura para usar Docker:
   - Root Directory: `python-backend`
   - Build Command: (vacío, usa el Dockerfile)
   - Start Command: (vacío, usa el Dockerfile)

### Frontend (Vercel)

1. Importa desde tu repositorio de GitHub
2. Configura las variables de entorno:
   - `NEXT_PUBLIC_API_URL`: URL de tu backend desplegado en Render

## Notas importantes

- Para que el frontend se comunique correctamente con el backend en desarrollo, asegúrate de que ambos estén ejecutándose.
- El archivo `.env.local` ya está configurado para conectarse al backend a través del proxy de Next.js.
- Si cambia la URL o puerto del backend, actualiza el archivo `next.config.js` en la sección de `rewrites`.

## Cómo funciona

La aplicación utiliza una arquitectura híbrida:

- **Frontend**: Next.js con React para la interfaz de usuario
- **Backend**: Función serverless de Python para el procesamiento de datos

La integración entre ambas tecnologías se realiza mediante Vercel Functions, permitiendo ejecutar código Python directamente en Vercel.

## Despliegue en Vercel

Para desplegar esta aplicación en Vercel, sigue estos pasos:

1. **Requisitos previos**:

   - Una cuenta en [Vercel](https://vercel.com)
   - [Git](https://git-scm.com/) instalado
   - [Node.js](https://nodejs.org/) (versión 18 o superior)

2. **Preparación para el despliegue**:

   - Asegúrate de que la estructura de carpetas sea correcta:
     - `/api/process-excel.py` - Función Python serverless
     - `/api/requirements.txt` - Dependencias de Python
     - `vercel.json` - Configuración de Vercel

3. **Configuración de Vercel**:

   - El archivo `vercel.json` ya está configurado con los siguientes ajustes importantes:
     - `runtime: "python3.12"` - Usa la versión más reciente de Python
     - `memory: 4096` - Asigna 4GB de memoria a la función
     - `maxDuration: 60` - Permite un máximo de 60 segundos de ejecución

4. **Despliegue**:

   ```bash
   # Instalar CLI de Vercel (si no está instalada)
   npm install -g vercel

   # Desplegar en Vercel
   vercel

   # Para producción
   vercel --prod
   ```

## Funcionamiento

1. El usuario sube un archivo Excel a través de la interfaz web.
2. La solicitud se envía a la API `/api/process-excel`.
3. La función Python procesa el archivo Excel:
   - Realiza un análisis de similitud
   - Genera una matriz de similitud tipo escalera
   - Crea un dendrograma
4. Los resultados se devuelven como imágenes en formato base64.
5. La interfaz web muestra las visualizaciones al usuario.

## Limitaciones en Vercel

Es importante tener en cuenta que las funciones serverless en Vercel tienen algunas limitaciones:

- **Tiempo de ejecución**: Máximo 60 segundos
- **Memoria**: Máximo 4GB
- **Tamaño de archivos**: Recomendable usar archivos pequeños/medianos

Para archivos grandes o análisis complejos, considera ejecutar la aplicación localmente.

## Desarrollo local

Para ejecutar la aplicación localmente:

```bash
# Instalar dependencias
pnpm install

# Ejecutar en modo desarrollo
pnpm dev
```

## Solución de problemas

Si encuentras errores al desplegar en Vercel:

1. Verifica los logs en el Dashboard de Vercel
2. Asegúrate de que todas las dependencias estén correctamente especificadas en `requirements.txt`
3. Comprueba que los límites de tiempo y memoria sean suficientes para tu caso de uso

## Tecnologías utilizadas

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Python, Pandas, Scikit-learn, Plotly
- **Infraestructura**: Vercel Functions
