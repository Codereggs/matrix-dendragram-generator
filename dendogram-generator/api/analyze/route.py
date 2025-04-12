import json
import sys
import os
import traceback
import numpy as np
import gc  # Garbage collector
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
from scipy.cluster.hierarchy import linkage, dendrogram
from fastapi import Response

# Configuración global para reducir uso de memoria
np.set_printoptions(precision=4)  # Reducir precisión para ahorrar memoria

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.float32) or isinstance(obj, np.float64):
            return float(obj)
        if isinstance(obj, np.int64) or isinstance(obj, np.int32):
            return int(obj)
        return json.JSONEncoder.default(self, obj)

def POST(request):
    try:
        print("========== INICIO API ANÁLISIS ==========")
        print(f"Python version: {sys.version}")
        print(f"NumPy version: {np.__version__}")
        print(f"Environment: {os.environ.get('VERCEL_ENV', 'local')}")
        
        # Obtener datos de la solicitud
        try:
            # En Next.js, se debe usar await request.json()
            # Ya que esto es una función de ruta Python, debemos acceder al cuerpo de otra manera
            data = request.json
        except Exception as e:
            error_msg = f"Error al procesar JSON de entrada: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            return {
                'success': False,
                'error': {
                    'code': 'analysis_error',
                    'message': error_msg
                }
            }
        
        # Verificar que tengamos los datos necesarios
        if 'descriptions' not in data or 'unique_ids' not in data or 'id_url_mapping' not in data:
            missing_keys = []
            if 'descriptions' not in data: missing_keys.append('descriptions')
            if 'unique_ids' not in data: missing_keys.append('unique_ids')
            if 'id_url_mapping' not in data: missing_keys.append('id_url_mapping')
            error_msg = f"Datos de entrada incompletos. Faltan: {', '.join(missing_keys)}"
            print(error_msg)
            return {
                'success': False,
                'error': {
                    'code': 'analysis_error',
                    'message': error_msg
                }
            }
        
        try:
            descriptions = data['descriptions']
            unique_ids = data['unique_ids']
            id_url_mapping = data['id_url_mapping']
            
            print(f"Datos recibidos para análisis: {len(descriptions)} descripciones, {len(unique_ids)} IDs")
            
            # Liberar memoria
            del data
            gc.collect()
        except Exception as e:
            error_msg = f"Error al extraer datos: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            return {
                'success': False,
                'error': {
                    'code': 'analysis_error',
                    'message': error_msg
                }
            }
        
        try:
            # Vectorizar con configuración altamente optimizada
            print("Vectorizando descripciones...")
            try:
                vectorizer = TfidfVectorizer(
                    stop_words='english',
                    max_features=500,
                    dtype=np.float32,
                    max_df=0.7,
                    min_df=2
                )
                tfidf_matrix = vectorizer.fit_transform(descriptions)
                print(f"Matriz TF-IDF creada con forma: {tfidf_matrix.shape}")
            except Exception as e:
                error_msg = f"Error en la vectorización TF-IDF: {str(e)}"
                print(error_msg)
                traceback.print_exc()
                return {
                    'success': False,
                    'error': {
                        'code': 'analysis_error',
                        'message': error_msg
                    }
                }
            
            # Liberar memoria
            del descriptions
            del vectorizer
            gc.collect()
            
            # Calcular similitud con precisión reducida
            print("Calculando matriz de similitud...")
            try:
                similarity_matrix = cosine_similarity(tfidf_matrix, dtype=np.float32)
                print(f"Matriz de similitud creada con forma: {similarity_matrix.shape}")
            except Exception as e:
                error_msg = f"Error al calcular similitud: {str(e)}"
                print(error_msg)
                traceback.print_exc()
                return {
                    'success': False,
                    'error': {
                        'code': 'analysis_error',
                        'message': error_msg
                    }
                }
            
            # Liberar memoria
            del tfidf_matrix
            gc.collect()
            
            # Procesar datos para dendrograma
            print("Generando datos de dendrograma...")
            try:
                Z = linkage(similarity_matrix, 'ward')
                dendro_data = dendrogram(Z, no_plot=True)
                ordered_indices = dendro_data['leaves']
                print(f"Dendrograma generado con {len(ordered_indices)} hojas")
            except Exception as e:
                error_msg = f"Error al generar dendrograma: {str(e)}"
                print(error_msg)
                traceback.print_exc()
                return {
                    'success': False,
                    'error': {
                        'code': 'analysis_error',
                        'message': error_msg
                    }
                }
            
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
            
            try:
                # Crear estructura para la matriz de similitud
                for i in range(len(ordered_indices)):
                    row = []
                    for j in range(len(ordered_indices)):
                        row.append(float(similarity_matrix[ordered_indices[i], ordered_indices[j]]))
                    heatmap_data.append(row)
                    
                    # Liberar memoria periódicamente
                    if i % batch_size == 0:
                        gc.collect()
            except Exception as e:
                error_msg = f"Error al preparar datos del mapa de calor: {str(e)}"
                print(error_msg)
                traceback.print_exc()
                return {
                    'success': False,
                    'error': {
                        'code': 'analysis_error',
                        'message': error_msg
                    }
                }
            
            # Liberar memoria
            del similarity_matrix
            del Z
            gc.collect()
            
            # IDs ordenados para el frontend
            ordered_ids = [str(unique_ids[idx]) for idx in ordered_indices]
            
            # Devolver resultado como datos JSON
            print("Análisis completado con éxito, enviando respuesta...")
            
            # Usando el NumpyEncoder para convertir los arrays de NumPy a listas
            result = {
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
            
            # Convertir a JSON manualmente para manejar los tipos de NumPy
            return json.loads(json.dumps(result, cls=NumpyEncoder))
            
        except Exception as e:
            error_msg = f"Error al analizar los datos: {str(e)}"
            print(error_msg)
            traceback.print_exc()
            return {
                'success': False,
                'error': {
                    'code': 'analysis_error',
                    'message': error_msg
                }
            }
            
    except Exception as e:
        error_msg = f"Error interno del servidor: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        return {
            'success': False,
            'error': {
                'code': 'analysis_error',
                'message': error_msg
            }
        } 