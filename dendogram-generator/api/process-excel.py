from http.server import BaseHTTPRequestHandler
import json
import base64
import io
import os
import polars as pl
import numpy as np
import tempfile
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
from scipy.cluster.hierarchy import linkage, dendrogram
import gc  # Garbage collector

# Configuración global para reducir uso de memoria
np.set_printoptions(precision=4)  # Reducir precisión para ahorrar memoria

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        temp_path = None
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            print("Procesando solicitud POST para Excel")
            
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
                
                # Cargar Excel con Polars y openpyxl
                df = pl.read_excel(
                    temp_path,
                    sheet_name=0,
                    read_options={"engine": "openpyxl"},
                    columns=["id", "url", "description"]
                )
                
                print(f"Datos cargados: {df.height} filas, {df.width} columnas")
                
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
                
                # Procesar datos - optimización de memoria
                print("Procesando matriz de similitud...")
                
                # Limitar muestra
                unique_ids = df.select("id").unique().to_series().to_list()
                sample_size = min(100, len(unique_ids))
                if len(unique_ids) > sample_size:
                    print(f"Reduciendo muestra a {sample_size} elementos para optimizar memoria")
                    unique_ids = unique_ids[:sample_size]
                
                # Extraer id y urls para enviar al frontend
                id_url_mapping = {}
                for item_id in unique_ids:
                    # Filtrar y obtener el primer registro para cada ID
                    item_data = df.filter(pl.col("id") == item_id)
                    if item_data.height > 0:
                        first_row = item_data.row(0)
                        id_url_mapping[str(first_row[0])] = first_row[1]  # id, url
                
                # Extraer descripciones - uso más eficiente de memoria
                descriptions = []
                for i, item_id in enumerate(unique_ids):
                    item_descriptions = df.filter(pl.col("id") == item_id).select("description").to_series().to_list()
                    descriptions.append(' '.join(item_descriptions))
                    # Liberar memoria cada 20 iteraciones
                    if i % 20 == 0:
                        gc.collect()
                
                # Liberar memoria del DataFrame original
                del df
                gc.collect()
                
                # Vectorizar con configuración altamente optimizada
                vectorizer = TfidfVectorizer(
                    stop_words='english',
                    max_features=500,
                    dtype=np.float32,
                    max_df=0.7,
                    min_df=2
                )
                tfidf_matrix = vectorizer.fit_transform(descriptions)
                
                # Liberar memoria
                del descriptions
                del vectorizer
                gc.collect()
                
                # Calcular similitud con precisión reducida
                print("Calculando matriz de similitud...")
                similarity_matrix = cosine_similarity(tfidf_matrix, dtype=np.float32)
                
                # Liberar memoria
                del tfidf_matrix
                gc.collect()
                
                # Procesar datos para dendrograma
                print("Generando datos de dendrograma...")
                Z = linkage(similarity_matrix, 'ward')
                dendro_data = dendrogram(Z, no_plot=True)
                ordered_indices = dendro_data['leaves']
                
                # Convertir dendrograma para frontend
                frontend_dendro_data = {
                    'ivl': dendro_data['ivl'],
                    'dcoord': dendro_data['dcoord'],
                    'icoord': dendro_data['icoord'],
                    'color_list': dendro_data['color_list'] if 'color_list' in dendro_data else [],
                }
                
                # Preparar matriz de similitud ordenada
                heatmap_data = []
                
                # Procesar por lotes para optimizar memoria
                batch_size = 20
                
                # Crear estructura para la matriz de similitud
                for i in range(len(ordered_indices)):
                    row = []
                    for j in range(len(ordered_indices)):
                        row.append(float(similarity_matrix[ordered_indices[i], ordered_indices[j]]))
                    heatmap_data.append(row)
                    
                    # Liberar memoria periódicamente
                    if i % batch_size == 0:
                        gc.collect()
                
                # Liberar memoria
                del similarity_matrix
                del Z
                gc.collect()
                
                # IDs ordenados para el frontend
                ordered_ids = [str(unique_ids[idx]) for idx in ordered_indices]
                
                # Devolver resultado como datos JSON para Plotly
                print("Procesamiento completado con éxito, enviando respuesta...")
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                
                response = {
                    'success': True,
                    'data': {
                        'heatmap': {
                            'z': heatmap_data,
                            'ids': ordered_ids
                        },
                        'dendrogram': frontend_dendro_data,
                        'metadata': {
                            'id_url_mapping': id_url_mapping
                        }
                    },
                    'message': 'Archivo procesado correctamente'
                }
                
                self.wfile.write(json.dumps(response, cls=NumpyEncoder).encode())
                
            except Exception as e:
                print(f"Error al procesar el archivo: {str(e)}")
                self.send_error_response(f"Error al procesar el archivo: {str(e)}")
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
                'code': 'processing_error',
                'message': error_message
            }
        }
        self.wfile.write(json.dumps(response).encode())

# Clase auxiliar para serializar arrays de NumPy a JSON
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.float32) or isinstance(obj, np.float64):
            return float(obj)
        if isinstance(obj, np.int64) or isinstance(obj, np.int32):
            return int(obj)
        return json.JSONEncoder.default(self, obj) 