# Guía de Despliegue en Vercel

Este proyecto utiliza una arquitectura híbrida con Next.js para el frontend y Python para el procesamiento de datos. Para desplegarlo correctamente en Vercel, sigue estos pasos:

## Requisitos Previos

1. Cuenta en Vercel
2. CLI de Vercel instalada localmente (opcional)
3. Acceso al repositorio de GitHub

## Pasos para el Despliegue

### 1. Configura las Variables de Entorno

En el panel de Vercel, asegúrate de configurar las siguientes variables de entorno:

- `VERCEL=1` - Indica que estamos ejecutando en entorno Vercel

### 2. Verifica la Configuración

Asegúrate de que existen estos archivos importantes:

- `vercel.json` - En la raíz del proyecto
- `app/api/python/process-excel/index.py` - El endpoint serverless de Python
- `app/api/python/process-excel/requirements.txt` - Las dependencias de Python

### 3. Realiza el Despliegue

Puedes desplegar directamente desde GitHub o usando la CLI de Vercel:

```bash
# Usando la CLI de Vercel
vercel

# Para despliegue de producción
vercel --prod
```

### 4. Solución de Problemas Comunes

Si encuentras errores, verifica estos aspectos:

- **Error de ejecución de Python**: Asegúrate de que todas las dependencias de Python estén en `requirements.txt`
- **Tiempo de ejecución agotado**: Incrementa el parámetro `maxDuration` en el archivo `vercel.json`
- **Límites de memoria**: Si se agotan los recursos, incrementa el parámetro `memory` en `vercel.json`

### 5. Acceso a los Logs

Para ver los logs de ejecución y depurar problemas:

1. Ve al dashboard de Vercel
2. Selecciona tu proyecto
3. Ve a la pestaña "Deployments"
4. Selecciona el despliegue específico
5. Ve a la pestaña "Functions" para ver los logs de las funciones serverless

## Notas Importantes

- La función Python se ejecuta como serverless, por lo que tiene limitaciones de tiempo y memoria
- Para archivos muy grandes o procesamiento intensivo, considera usar servicios externos
- El procesamiento de imágenes con matplotlib y scipy puede consumir bastante memoria

Si tienes problemas específicos, consulta la [documentación de Vercel para Python](https://vercel.com/docs/functions/serverless-functions/runtimes/python).
