# Generador de Dendrogramas y Matrices

Esta aplicación procesa archivos Excel para generar matrices de similitud y dendrogramas utilizando Python en el backend y Next.js en el frontend.

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
