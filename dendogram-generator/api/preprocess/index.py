from http.server import BaseHTTPRequestHandler
import json
import base64
import io
import os
import pandas as pd
import numpy as np
import tempfile
import gc  # Garbage collector

# Configuración global para reducir uso de memoria
np.set_printoptions(precision=4)  # Reducir precisión para ahorrar memoria

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        temp_path = None
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            print("Preprocesando archivo Excel")
            
            # Procesar los datos recibidos
            data = json.loads(post_data.decode('utf-8'))
            del post_data  # Liberar memoria
            
            if 'fileBase64' not in data:
                self.send_error_response("No se proporcionó un archivo válido")
                return
            
            # Decodificar el archivo desde base64
            file_content = base64.b64decode(data['fileBase64'])
            print(f"Archivo recibido, tamaño: {len(file_content)} bytes")
            del data  # Liberar memoria
            gc.collect()
            
            # Crear un archivo temporal para almacenar los datos
            with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
                temp_file.write(file_content)
                temp_path = temp_file.name
            
            # Liberar memoria
            del file_content
            gc.collect()
            
            try:
                print(f"Procesando archivo Excel: {temp_path}")
                
                # Cargar Excel con pandas y openpyxl
                df = pd.read_excel(
                    temp_path,
                    sheet_name=0,
                    engine="openpyxl",
                    usecols=["id", "url", "description"]
                )
                
                print(f"Datos cargados: {df.shape[0]} filas, {df.shape[1]} columnas")
                
                # Liberar memoria del archivo temporal
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    temp_path = None
                
                # Verificar columnas requeridas
                required_columns = ['id', 'url', 'description']
                missing_columns = [col for col in required_columns if col not in df.columns]
                if missing_columns:
                    error_msg = f"Columnas faltantes: {', '.join(missing_columns)}"
                    print(f"Error: {error_msg}")
                    self.send_error_response(error_msg)
                    return
                
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
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                
                response = {
                    'success': True,
                    'data': {
                        'descriptions': descriptions,
                        'unique_ids': unique_ids,
                        'id_url_mapping': id_url_mapping
                    },
                    'message': 'Archivo preprocesado correctamente'
                }
                
                self.wfile.write(json.dumps(response).encode())
                
            except Exception as e:
                print(f"Error al preprocesar el archivo: {str(e)}")
                self.send_error_response(f"Error al preprocesar el archivo: {str(e)}")
            finally:
                # Limpiar archivos temporales
                if temp_path and os.path.exists(temp_path):
                    try:
                        os.unlink(temp_path)
                        print("Archivos temporales eliminados")
                    except Exception as e:
                        print(f"Error al eliminar archivos temporales: {str(e)}")
                
        except Exception as e:
            print(f"Error interno del servidor: {str(e)}")
            self.send_error_response(f"Error interno del servidor: {str(e)}")
    
    def send_error_response(self, error_message):
        self.send_response(400)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        response = {
            'success': False,
            'error': {
                'code': 'preprocessing_error',
                'message': error_message
            }
        }
        self.wfile.write(json.dumps(response).encode()) 