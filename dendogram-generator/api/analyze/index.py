from http.server import BaseHTTPRequestHandler
import json
import numpy as np
import gc  # Garbage collector
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
from scipy.cluster.hierarchy import linkage, dendrogram

# Configuración global para reducir uso de memoria
np.set_printoptions(precision=4)  # Reducir precisión para ahorrar memoria

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            print("Analizando datos preprocesados")
            
            # Procesar los datos recibidos
            data = json.loads(post_data.decode('utf-8'))
            del post_data  # Liberar memoria
            
            # Verificar que tengamos los datos necesarios
            if 'descriptions' not in data or 'unique_ids' not in data or 'id_url_mapping' not in data:
                self.send_error_response("Datos de entrada incompletos")
                return
            
            descriptions = data['descriptions']
            unique_ids = data['unique_ids']
            id_url_mapping = data['id_url_mapping']
            
            # Liberar memoria
            del data
            gc.collect()
            
            try:
                # Vectorizar con configuración altamente optimizada
                print("Vectorizando descripciones...")
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
                
                # Devolver resultado como datos JSON
                print("Análisis completado con éxito, enviando respuesta...")
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
                    'message': 'Análisis completado correctamente'
                }
                
                self.wfile.write(json.dumps(response, cls=NumpyEncoder).encode())
                
            except Exception as e:
                print(f"Error al analizar los datos: {str(e)}")
                self.send_error_response(f"Error al analizar los datos: {str(e)}")
                
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
                'code': 'analysis_error',
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