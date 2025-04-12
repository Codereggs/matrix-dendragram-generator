from flask import Flask, jsonify, request
import base64
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy.cluster.hierarchy import dendrogram, linkage
import io
import os
import tempfile
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

app = Flask(__name__)

@app.route('/api/python/process-excel', methods=['POST'])
def process_excel():
    try:
        # Obtener los datos JSON
        data = request.json
        
        if not data or 'fileBase64' not in data:
            return jsonify({
                'error': 'No se proporcionó un archivo válido',
                'details': 'Falta el archivo en base64'
            }), 400
        
        # Decodificar el archivo
        file_content = base64.b64decode(data['fileBase64'])
        
        # Crear un archivo temporal para los datos
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
            temp_file.write(file_content)
            temp_path = temp_file.name
        
        # Crear directorio temporal para las imágenes
        temp_dir = tempfile.mkdtemp()
        
        try:
            # Procesar el archivo Excel
            df = pd.read_excel(temp_path, sheet_name=0)
            
            # Verificar columnas
            required_columns = ['id', 'url', 'description']
            for column in required_columns:
                if column not in df.columns:
                    raise ValueError(f"Columna faltante: {column}")
            
            # Inicializar resultado
            result_images = {}
            
            # Procesar datos
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
            
            # Matriz tipo escalera
            plt.figure(figsize=(12, 10))
            Z = linkage(similarity_matrix, 'ward')
            dendrogram_data = dendrogram(Z, no_plot=True)
            ordered_indices = dendrogram_data['leaves']
            
            # Reordenar matriz
            ordered_matrix = similarity_matrix[ordered_indices, :]
            ordered_matrix = ordered_matrix[:, ordered_indices]
            
            # Generar heatmap
            ax = sns.heatmap(ordered_matrix, cmap='Blues', 
                           xticklabels=False, yticklabels=False, 
                           cbar_kws={'label': 'Similitud'})
            
            plt.title('Matriz de Similitud (Tipo Escalera)')
            
            # Guardar como base64
            matrix_buffer = io.BytesIO()
            plt.savefig(matrix_buffer, format='png', bbox_inches='tight', dpi=150)
            matrix_buffer.seek(0)
            matrix_base64 = base64.b64encode(matrix_buffer.read()).decode('utf-8')
            result_images['matriz_escalera'] = f'data:image/png;base64,{matrix_base64}'
            
            plt.close()
            
            # Dendrograma
            plt.figure(figsize=(12, 8))
            Z = linkage(similarity_matrix, method='ward')
            dendrogram(Z, orientation='top', leaf_font_size=10, color_threshold=0.7*max(Z[:,2]))
            
            plt.title('Dendrograma de Análisis')
            plt.xlabel('Índices de los Elementos')
            plt.ylabel('Distancia')
            
            # Guardar como base64
            dendro_buffer = io.BytesIO()
            plt.savefig(dendro_buffer, format='png', bbox_inches='tight', dpi=150)
            dendro_buffer.seek(0)
            dendro_base64 = base64.b64encode(dendro_buffer.read()).decode('utf-8')
            result_images['dendrograma'] = f'data:image/png;base64,{dendro_base64}'
            
            plt.close()
            
            # Devolver resultado
            return jsonify({
                'matriz_escalera': result_images.get('matriz_escalera', ''),
                'dendrograma': result_images.get('dendrograma', '')
            })
            
        except Exception as e:
            return jsonify({
                'error': str(e),
                'details': 'Error al procesar el archivo Excel'
            }), 500
        finally:
            # Limpiar temporales
            try:
                os.unlink(temp_path)
                os.rmdir(temp_dir)
            except:
                pass
    
    except Exception as e:
        return jsonify({
            'error': 'Error interno del servidor',
            'details': str(e)
        }), 500

# Para desarrollo local
if __name__ == '__main__':
    app.run(port=5328, debug=True)

# Para Vercel
handler = app 