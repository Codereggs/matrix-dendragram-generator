from flask import Flask, jsonify, request
import base64
import pandas as pd
import numpy as np
import io
import os
import sys
import tempfile
import traceback
import plotly.express as px
import plotly.figure_factory as ff
from plotly.subplots import make_subplots
import plotly.graph_objects as go
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

app = Flask(__name__)

@app.route('/api/python/process-excel', methods=['POST'])
def process_excel():
    try:
        print("Iniciando procesamiento de Excel en serverless...")
        
        # Obtener los datos JSON
        data = request.json
        
        if not data or 'fileBase64' not in data:
            print("Error: No se proporcionó un archivo válido")
            return jsonify({
                'error': 'No se proporcionó un archivo válido',
                'details': 'Falta el archivo en base64'
            }), 400
        
        # Decodificar el archivo
        try:
            file_content = base64.b64decode(data['fileBase64'])
            print(f"Archivo decodificado correctamente, tamaño: {len(file_content)} bytes")
        except Exception as e:
            print(f"Error al decodificar el archivo: {str(e)}")
            return jsonify({
                'error': 'Error al decodificar el archivo',
                'details': str(e)
            }), 400
        
        # Crear un archivo temporal para los datos
        try:
            with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
                temp_file.write(file_content)
                temp_path = temp_file.name
                print(f"Archivo temporal creado en {temp_path}")
        except Exception as e:
            print(f"Error al crear archivo temporal: {str(e)}")
            return jsonify({
                'error': 'Error al crear archivo temporal',
                'details': str(e)
            }), 500
        
        try:
            # Procesar el archivo Excel
            print("Leyendo archivo Excel...")
            df = pd.read_excel(temp_path, sheet_name=0)
            print(f"DataFrame cargado con éxito: {df.shape[0]} filas, {df.shape[1]} columnas")
            
            # Verificar columnas
            required_columns = ['id', 'url', 'description']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                error_msg = f"Columnas faltantes: {', '.join(missing_columns)}"
                print(error_msg)
                return jsonify({
                    'error': error_msg,
                    'details': f"Columnas disponibles: {', '.join(df.columns)}"
                }), 400
            
            # Inicializar resultado
            result_images = {}
            
            # Procesar datos
            print("Procesando datos...")
            unique_ids = df['id'].unique()
            print(f"IDs únicos encontrados: {len(unique_ids)}")
            
            # Extraer descripciones
            descriptions = []
            for item_id in unique_ids:
                item_descriptions = df[df['id'] == item_id]['description'].tolist()
                descriptions.append(' '.join(item_descriptions))
            
            # Vectorizar
            print("Vectorizando descripciones...")
            vectorizer = TfidfVectorizer(stop_words='english')
            tfidf_matrix = vectorizer.fit_transform(descriptions)
            
            # Calcular similitud
            print("Calculando matriz de similitud...")
            similarity_matrix = cosine_similarity(tfidf_matrix)
            
            # Generar matriz de similitud tipo escalera con Plotly
            print("Generando matriz tipo escalera con Plotly...")
            from scipy.cluster.hierarchy import linkage
            Z = linkage(similarity_matrix, 'ward')
            
            # Obtener el orden de los índices
            from scipy.cluster.hierarchy import dendrogram
            dendro = dendrogram(Z, no_plot=True)
            ordered_indices = dendro['leaves']
            
            # Reordenar la matriz de similitud
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
            print("Generando dendrograma con Plotly...")
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
            print("Procesamiento completado con éxito")
            return jsonify({
                'matriz_escalera': result_images.get('matriz_escalera', ''),
                'dendrograma': result_images.get('dendrograma', '')
            })
            
        except Exception as e:
            print(f"Error durante el procesamiento: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            return jsonify({
                'error': str(e),
                'details': traceback.format_exc()
            }), 500
        finally:
            # Limpiar temporales
            try:
                if 'temp_path' in locals():
                    os.unlink(temp_path)
                    print(f"Archivo temporal eliminado: {temp_path}")
            except Exception as cleanup_error:
                print(f"Error al eliminar archivo temporal: {str(cleanup_error)}")
    
    except Exception as e:
        print(f"Error general: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'error': 'Error interno del servidor',
            'details': traceback.format_exc()
        }), 500

# Para desarrollo local
if __name__ == '__main__':
    app.run(port=5328, debug=True)

# Para Vercel
handler = app 