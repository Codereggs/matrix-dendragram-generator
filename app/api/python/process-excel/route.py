from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy.cluster.hierarchy import dendrogram, linkage
import base64
import io
import os
import sys
import tempfile
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)

@app.route('/api/python/process-excel', methods=['POST'])
def process_excel():
    try:
        # Obtener los datos del JSON
        data = request.json
        
        if not data or 'fileBase64' not in data:
            return jsonify({
                'error': 'No se proporcionó un archivo válido',
                'details': 'Falta el archivo en base64'
            }), 400
        
        # Decodificar el archivo desde base64
        file_content = base64.b64decode(data['fileBase64'])
        
        # Crear un archivo temporal para almacenar los datos
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
            temp_file.write(file_content)
            temp_path = temp_file.name
        
        # Crear directorio temporal para las imágenes
        temp_dir = tempfile.mkdtemp()
        
        try:
            # Procesar el archivo y generar las imágenes
            result_images = generate_charts(temp_path, temp_dir)
            
            # Devolver las imágenes en formato base64
            return jsonify({
                'matriz_escalera': result_images.get('matriz_escalera', {}).get('base64', ''),
                'dendrograma': result_images.get('dendrograma', {}).get('base64', '')
            })
            
        except Exception as e:
            return jsonify({
                'error': str(e),
                'details': 'Error al procesar el archivo Excel'
            }), 500
        finally:
            # Limpiar archivos temporales
            try:
                os.unlink(temp_path)
                for img in os.listdir(temp_dir):
                    os.unlink(os.path.join(temp_dir, img))
                os.rmdir(temp_dir)
            except:
                pass
                
    except Exception as e:
        return jsonify({
            'error': 'Error interno del servidor',
            'details': str(e)
        }), 500

def generate_charts(file_path, output_dir=None):
    """
    Genera gráficos a partir de un archivo Excel
    
    Args:
        file_path (str): Ruta del archivo Excel
        output_dir (str, optional): Directorio de salida para las imágenes. Por defecto None.
        
    Returns:
        dict: Diccionario con las imágenes generadas en formato base64
    """
    try:
        # Cargar el archivo Excel
        df = pd.read_excel(file_path, sheet_name=0)
        
        # Verificar columnas requeridas
        required_columns = ['id', 'url', 'description']
        for column in required_columns:
            if column not in df.columns:
                raise ValueError(f"Columna requerida no encontrada: {column}")
        
        # Inicializar diccionario para almacenar resultados
        result_images = {}
        
        # Preparar matriz de similitud
        # Crear una matriz de features binarias
        unique_ids = df['id'].unique()
        num_items = len(unique_ids)
        
        # Diccionario para mapear item_id -> índice
        id_to_index = {item_id: i for i, item_id in enumerate(unique_ids)}
        
        # Extraer descripciones para cada ID único
        descriptions = []
        for item_id in unique_ids:
            item_descriptions = df[df['id'] == item_id]['description'].tolist()
            # Unir todas las descripciones de este ítem
            descriptions.append(' '.join(item_descriptions))
        
        # Convertir descripciones a vectores TF-IDF
        from sklearn.feature_extraction.text import TfidfVectorizer
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(descriptions)
        
        # Calcular similitud del coseno
        similarity_matrix = cosine_similarity(tfidf_matrix)
        
        # Generar matriz de similitud tipo escalera
        try:
            plt.figure(figsize=(12, 10))
            # Generar el dendrograma para obtener el orden de las filas
            Z = linkage(similarity_matrix, 'ward')
            dendrogram_data = dendrogram(Z, no_plot=True)
            ordered_indices = dendrogram_data['leaves']
            
            # Reordenar la matriz de similitud
            ordered_matrix = similarity_matrix[ordered_indices, :]
            ordered_matrix = ordered_matrix[:, ordered_indices]
            
            # Generar el heatmap con la matriz reordenada
            ax = sns.heatmap(ordered_matrix, cmap='Blues', 
                            xticklabels=False, yticklabels=False, 
                            cbar_kws={'label': 'Similitud'})
            
            plt.title('Matriz de Similitud (Tipo Escalera)')
            
            # Guardar la imagen
            matrix_stair_path = os.path.join(output_dir, 'matriz_similitud_escalera.png')
            plt.savefig(matrix_stair_path, bbox_inches='tight', dpi=150)
            
            # Convertir a base64
            with open(matrix_stair_path, 'rb') as img_file:
                matrix_stair_base64 = base64.b64encode(img_file.read()).decode('utf-8')
            
            result_images['matriz_escalera'] = {
                'path': matrix_stair_path,
                'base64': f'data:image/png;base64,{matrix_stair_base64}'
            }
            
            plt.close()
            print("Matriz de similitud tipo escalera guardada.")
        except Exception as e:
            print(f"ERROR: No se pudo generar la matriz tipo escalera: {str(e)}")
            plt.close()
        
        # Generar dendrograma
        try:
            plt.figure(figsize=(12, 8))
            
            # Calcular el linkage
            Z = linkage(similarity_matrix, method='ward')
            
            # Dibujar el dendrograma
            dendrogram(Z, orientation='top', leaf_font_size=10, color_threshold=0.7*max(Z[:,2]))
            
            plt.title('Dendrograma de Análisis')
            plt.xlabel('Índices de los Elementos')
            plt.ylabel('Distancia')
            
            # Guardar el dendrograma
            dendro_path = os.path.join(output_dir, 'dendrograma_card_sorting.png')
            plt.savefig(dendro_path, bbox_inches='tight', dpi=150)
            
            # Convertir a base64
            with open(dendro_path, 'rb') as img_file:
                dendro_base64 = base64.b64encode(img_file.read()).decode('utf-8')
            
            result_images['dendrograma'] = {
                'path': dendro_path,
                'base64': f'data:image/png;base64,{dendro_base64}'
            }
            
            plt.close()
            print("Dendrograma guardado.")
        except Exception as e:
            print(f"ERROR: No se pudo generar el dendrograma: {str(e)}")
            plt.close()
        
        # Verificar que se generaron las visualizaciones requeridas
        required_images = ['matriz_escalera', 'dendrograma']
        missing_images = [img for img in required_images if img not in result_images]
        
        if missing_images:
            print(f"ERROR: No se pudieron generar las siguientes visualizaciones: {', '.join(missing_images)}")
            raise ValueError(f"Faltan visualizaciones: {', '.join(missing_images)}")

        return result_images

    except Exception as e:
        print(f"ERROR GENERAL: {str(e)}")
        # Asegurarnos de cerrar todas las figuras en caso de error
        plt.close('all')
        raise e 