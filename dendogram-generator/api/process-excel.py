from http.server import BaseHTTPRequestHandler
import json
import base64
import io
import os
import pandas as pd
import numpy as np
import tempfile
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
from scipy.cluster.hierarchy import linkage, dendrogram
import plotly.express as px
import plotly.figure_factory as ff

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            print("Procesando solicitud POST para Excel")
            
            # Procesar los datos recibidos
            data = json.loads(post_data.decode('utf-8'))
            
            if 'fileBase64' not in data:
                self.send_error_response("No se proporcionó un archivo válido")
                return
            
            # Decodificar el archivo desde base64
            file_content = base64.b64decode(data['fileBase64'])
            print(f"Archivo recibido, tamaño: {len(file_content)} bytes")
            
            # Crear un archivo temporal para almacenar los datos
            with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
                temp_file.write(file_content)
                temp_path = temp_file.name
            
            try:
                print(f"Procesando archivo Excel: {temp_path}")
                # Procesar el archivo Excel
                df = pd.read_excel(temp_path, sheet_name=0)
                print(f"Datos cargados: {df.shape[0]} filas, {df.shape[1]} columnas")
                
                # Verificar columnas requeridas
                required_columns = ['id', 'url', 'description']
                missing_columns = [col for col in required_columns if col not in df.columns]
                if missing_columns:
                    error_msg = f"Columnas faltantes: {', '.join(missing_columns)}"
                    print(f"Error: {error_msg}")
                    self.send_error_response(error_msg)
                    return
                
                # Inicializar resultado
                result_images = {}
                
                # Procesar datos
                print("Procesando matriz de similitud...")
                unique_ids = df['id'].unique()
                
                # Extraer descripciones
                descriptions = []
                for item_id in unique_ids:
                    item_descriptions = df[df['id'] == item_id]['description'].tolist()
                    descriptions.append(' '.join(item_descriptions))
                
                # Vectorizar
                vectorizer = TfidfVectorizer(stop_words='english')
                tfidf_matrix = vectorizer.fit_transform(descriptions)
                
                # Calcular similitud
                similarity_matrix = cosine_similarity(tfidf_matrix)
                
                # Matriz tipo escalera con Plotly
                print("Generando matriz tipo escalera...")
                Z = linkage(similarity_matrix, 'ward')
                dendro_data = dendrogram(Z, no_plot=True)
                ordered_indices = dendro_data['leaves']
                
                # Reordenar matriz
                ordered_matrix = similarity_matrix[ordered_indices, :]
                ordered_matrix = ordered_matrix[:, ordered_indices]
                
                # Crear heatmap con Plotly
                fig_heatmap = px.imshow(
                    ordered_matrix,
                    color_continuous_scale='Blues',
                    title='Matriz de Similitud (Tipo Escalera)'
                )
                fig_heatmap.update_layout(
                    width=800,
                    height=700,
                    xaxis=dict(showticklabels=False),
                    yaxis=dict(showticklabels=False)
                )
                
                # Guardar como base64
                print("Convirtiendo matriz a base64...")
                matrix_buffer = io.BytesIO()
                fig_heatmap.write_image(matrix_buffer, format='png')
                matrix_buffer.seek(0)
                matrix_base64 = base64.b64encode(matrix_buffer.read()).decode('utf-8')
                result_images['matriz_escalera'] = f'data:image/png;base64,{matrix_base64}'
                
                # Dendrograma con Plotly
                print("Generando dendrograma...")
                fig_dendro = ff.create_dendrogram(
                    similarity_matrix,
                    orientation='top',
                    linkagefun=lambda x: linkage(x, 'ward')
                )
                fig_dendro.update_layout(
                    width=900,
                    height=600,
                    title='Dendrograma de Análisis',
                    xaxis_title='Índices de los Elementos',
                    yaxis_title='Distancia'
                )
                
                # Guardar como base64
                print("Convirtiendo dendrograma a base64...")
                dendro_buffer = io.BytesIO()
                fig_dendro.write_image(dendro_buffer, format='png')
                dendro_buffer.seek(0)
                dendro_base64 = base64.b64encode(dendro_buffer.read()).decode('utf-8')
                result_images['dendrograma'] = f'data:image/png;base64,{dendro_base64}'
                
                # Devolver resultado
                print("Procesamiento completado con éxito, enviando respuesta...")
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {
                    'success': True,
                    'data': {
                        'matriz_escalera': result_images.get('matriz_escalera', ''),
                        'dendrograma': result_images.get('dendrograma', '')
                    },
                    'message': 'Archivo procesado correctamente'
                }
                self.wfile.write(json.dumps(response).encode())
                
            except Exception as e:
                print(f"Error al procesar el archivo: {str(e)}")
                self.send_error_response(f"Error al procesar el archivo: {str(e)}")
            finally:
                # Limpiar archivos temporales
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