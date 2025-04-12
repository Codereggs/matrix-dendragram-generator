from http.server import BaseHTTPRequestHandler
import json
import base64
import io
import os
import sys
import traceback
import pandas as pd
import numpy as np
import tempfile
import gc  # Garbage collector
from fastapi import Response

# Configuración global para reducir uso de memoria
np.set_printoptions(precision=4)  # Reducir precisión para ahorrar memoria

def POST(request):
    temp_path = None
    try:
        print("========== INICIO API PREPROCESAMIENTO ==========")
        print(f"Python version: {sys.version}")
        print(f"Pandas version: {pd.__version__}")
        print(f"Numpy version: {np.__version__}")
        print(f"Environment: {os.environ.get('VERCEL_ENV', 'local')}")
        
        # Obtener datos de la solicitud
        try:
            # En Next.js, se debe usar await request.json()
            # Ya que esto es una función de ruta Python, debemos acceder al cuerpo de otra manera
            data = request.json
            
            if 'fileBase64' not in data:
                error_response = {
                    'success': False,
                    'error': {
                        'code': 'preprocessing_error',
                        'message': "No se proporcionó un archivo válido"
                    }
                }
                return error_response
            
            # Verificar el tamaño del base64
            base64_len = len(data['fileBase64'])
            print(f"Longitud de datos base64 recibidos: {base64_len}")
            
            # Decodificar el archivo desde base64
            file_content = base64.b64decode(data['fileBase64'])
            print(f"Archivo decodificado, tamaño: {len(file_content)} bytes")
            del data  # Liberar memoria
            gc.collect()
        except Exception as e:
            error_msg = f"Error al procesar JSON de entrada: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            return {
                'success': False,
                'error': {
                    'code': 'preprocessing_error',
                    'message': error_msg
                }
            }
        
        # Crear un archivo temporal para almacenar los datos
        try:
            with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
                temp_file.write(file_content)
                temp_path = temp_file.name
            
            print(f"Archivo temporal creado: {temp_path}")
            
            # Liberar memoria
            del file_content
            gc.collect()
        except Exception as e:
            error_msg = f"Error al crear archivo temporal: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            return {
                'success': False,
                'error': {
                    'code': 'preprocessing_error',
                    'message': error_msg
                }
            }
        
        try:
            print(f"Procesando archivo Excel: {temp_path}")
            
            # Cargar Excel con pandas y openpyxl
            try:
                df = pd.read_excel(
                    temp_path,
                    sheet_name=0,
                    engine="openpyxl"
                )
                print(f"Columnas disponibles: {df.columns.tolist()}")
                
                # Verificar si tenemos las columnas necesarias
                required_columns = ['id', 'url', 'description']
                missing_columns = [col for col in required_columns if col not in df.columns]
                if missing_columns:
                    error_msg = f"Columnas faltantes: {', '.join(missing_columns)}"
                    print(f"Error: {error_msg}")
                    return {
                        'success': False,
                        'error': {
                            'code': 'preprocessing_error',
                            'message': error_msg
                        }
                    }
                
                print(f"Datos cargados: {df.shape[0]} filas, {df.shape[1]} columnas")
            except Exception as excel_err:
                error_msg = f"Error al leer el archivo Excel: {str(excel_err)}"
                print(error_msg)
                traceback.print_exc()
                return {
                    'success': False,
                    'error': {
                        'code': 'preprocessing_error',
                        'message': error_msg
                    }
                }
            
            # Liberar memoria del archivo temporal
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                temp_path = None
                print("Archivo temporal eliminado después de cargar Excel")
            
            # Preprocesar datos - optimización de memoria
            print("Preprocesando datos para análisis...")
            
            # Limitar muestra
            unique_ids = df['id'].unique().tolist()
            sample_size = min(100, len(unique_ids))
            if len(unique_ids) > sample_size:
                print(f"Reduciendo muestra a {sample_size} elementos para optimizar memoria")
                unique_ids = unique_ids[:sample_size]
            
            # Extraer id y urls para enviar al frontend
            id_url_mapping = {}
            for item_id in unique_ids:
                # Filtrar y obtener el primer registro para cada ID
                item_data = df[df['id'] == item_id]
                if not item_data.empty:
                    first_row = item_data.iloc[0]
                    id_url_mapping[str(first_row['id'])] = first_row['url']
            
            # Extraer descripciones - uso más eficiente de memoria
            descriptions = []
            for i, item_id in enumerate(unique_ids):
                item_descriptions = df[df['id'] == item_id]['description'].tolist()
                descriptions.append(' '.join(item_descriptions))
                # Liberar memoria cada 20 iteraciones
                if i % 20 == 0:
                    gc.collect()
            
            # Liberar memoria del DataFrame original
            del df
            gc.collect()
            
            # Devolver resultado como datos JSON para la segunda fase
            print("Preprocesamiento completado, enviando respuesta...")
            
            return {
                'success': True,
                'data': {
                    'descriptions': descriptions,
                    'unique_ids': unique_ids,
                    'id_url_mapping': id_url_mapping
                },
                'message': 'Archivo preprocesado correctamente'
            }
            
        except Exception as e:
            error_msg = f"Error al preprocesar el archivo: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            return {
                'success': False,
                'error': {
                    'code': 'preprocessing_error',
                    'message': error_msg
                }
            }
        finally:
            # Limpiar archivos temporales
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                    print("Archivos temporales eliminados")
                except Exception as e:
                    print(f"Error al eliminar archivos temporales: {str(e)}")
            
    except Exception as e:
        error_msg = f"Error interno del servidor: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        return {
            'success': False,
            'error': {
                'code': 'preprocessing_error',
                'message': error_msg
            }
        } 