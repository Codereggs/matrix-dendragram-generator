import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy.spatial.distance import pdist, squareform
from scipy.cluster.hierarchy import linkage, dendrogram
import matplotlib.colors as mcolors
import os
import sys
import tempfile
from io import BytesIO
import base64

def generate_charts(file_path, output_dir=None):
    """
    Genera los gráficos de card sorting a partir de un archivo Excel.
    
    Args:
        file_path (str): Ruta al archivo Excel
        output_dir (str, optional): Directorio donde guardar las imágenes. Si es None, se crea uno temporal.
        
    Returns:
        dict: Diccionario con las rutas de las imágenes generadas y sus representaciones en base64
    """
    # Si no se especifica un directorio de salida, crear uno temporal
    if output_dir is None:
        output_dir = tempfile.mkdtemp()
    
    # Asegurar que el directorio exista
    os.makedirs(output_dir, exist_ok=True)
    
    # Configuración de estilo para gráficos más profesionales
    plt.style.use('seaborn-v0_8-whitegrid')
    plt.rcParams['font.family'] = 'sans-serif'
    plt.rcParams['font.sans-serif'] = ['Arial', 'Helvetica', 'DejaVu Sans']
    plt.rcParams['axes.labelsize'] = 12
    plt.rcParams['axes.titlesize'] = 14
    plt.rcParams['xtick.labelsize'] = 10
    plt.rcParams['ytick.labelsize'] = 10

    # Cargar datos desde el archivo Excel
    df = pd.read_excel(file_path)

    # Verificar columnas
    print("Columnas del archivo:", df.columns)
    print("Tamaño del DataFrame:", df.shape)

    # ------ MATRIZ DE CO-OCURRENCIA PARA CARD SORTING ------
    # Necesitamos 'participant', 'card index' y 'sorted position' o 'category label'

    # Verificar si tenemos las columnas necesarias
    required_cols = ['participant', 'card index']
    sorting_cols = ['sorted position', 'category label']

    # Verificar que tengamos las columnas requeridas
    if not all(col in df.columns for col in required_cols):
        raise ValueError(f"ERROR: Faltan columnas requeridas. Necesitamos {required_cols}")

    # Verificar que tengamos al menos una columna de agrupación
    if not any(col in df.columns for col in sorting_cols):
        raise ValueError(f"ERROR: Necesitamos al menos una de estas columnas: {sorting_cols}")
        
    # Determinar qué columna usar para la agrupación
    grouping_col = next((col for col in sorting_cols if col in df.columns), None)
    print(f"\nUsando '{grouping_col}' para la agrupación")

    # Limpiar datos
    # Rellenar valores NaN en la columna de agrupación
    if pd.api.types.is_numeric_dtype(df[grouping_col]):
        df[grouping_col] = df[grouping_col].fillna(-1)  # -1 para valores numéricos
    else:
        df[grouping_col] = df[grouping_col].fillna("Sin grupo")  # Para valores de texto

    # Filtrar solo las columnas necesarias
    df_clean = df[required_cols + [grouping_col]].copy()
    print("\nDatos limpios para análisis:", df_clean.shape)

    # Obtener lista única de tarjetas
    cards = sorted(df_clean['card index'].unique())
    num_cards = len(cards)
    print(f"\nNúmero de tarjetas únicas: {num_cards}")

    # Crear diccionario para mapear índices a etiquetas más descriptivas
    card_labels = {}
    if 'card label' in df.columns:
        for _, row in df[['card index', 'card label']].drop_duplicates().iterrows():
            if not pd.isna(row['card label']):
                card_labels[row['card index']] = row['card label']
            else:
                card_labels[row['card index']] = f"Card {row['card index']}"
    else:
        for card in cards:
            card_labels[card] = f"Card {card}"

    # Crear matriz de co-ocurrencia
    card_idx = {card: i for i, card in enumerate(cards)}
    cooccurrence_matrix = np.zeros((num_cards, num_cards))

    # Para cada participante, encontrar tarjetas agrupadas juntas
    for participant in df_clean['participant'].unique():
        participant_data = df_clean[df_clean['participant'] == participant]
        
        # Agrupar por la columna de agrupación
        for group in participant_data[grouping_col].unique():
            # Tarjetas en este grupo para este participante
            group_cards = participant_data[participant_data[grouping_col] == group]['card index'].values
            
            # Si hay más de una tarjeta en el grupo, incrementar co-ocurrencias
            if len(group_cards) > 1:
                for i in range(len(group_cards)):
                    for j in range(i+1, len(group_cards)):
                        card1_idx = card_idx[group_cards[i]]
                        card2_idx = card_idx[group_cards[j]]
                        # Incrementar en ambas direcciones (matriz simétrica)
                        cooccurrence_matrix[card1_idx, card2_idx] += 1
                        cooccurrence_matrix[card2_idx, card1_idx] += 1

    # Calcular el máximo de co-ocurrencias para normalización
    max_cooccur = cooccurrence_matrix.max()
    if max_cooccur > 0:
        similarity_percentage = (cooccurrence_matrix / max_cooccur) * 100
    else:
        similarity_percentage = cooccurrence_matrix * 100

    # Convertir a un DataFrame para mejor visualización
    label_list = [card_labels[card] for card in cards]
    similarity_df = pd.DataFrame(similarity_percentage, index=label_list, columns=label_list)

    # Preparar etiquetas más legibles
    labels_short = []
    for label in label_list:
        # Acortar etiquetas largas
        if len(label) > 15:
            labels_short.append(label[:12] + '...')
        else:
            labels_short.append(label)

    # Diccionario para almacenar las rutas de las imágenes y sus datos en base64
    result_images = {}
    
    # -------- MATRIZ DE SIMILITUD MEJORADA --------
    # Crear un mapa de color personalizado
    cmap = sns.color_palette("Blues", as_cmap=True)

    plt.figure(figsize=(14, 12))
    ax = plt.subplot(111)

    # Crear mapa de calor con estilo mejorado
    heatmap = sns.heatmap(similarity_df, 
                        cmap=cmap,
                        square=True,
                        linewidths=.5,
                        cbar_kws={"shrink": .8, "label": "Similitud (%)"},
                        xticklabels=labels_short,
                        yticklabels=labels_short,
                        vmin=0, 
                        vmax=100,
                        annot=True,
                        fmt=".0f")

    # Mejorar apariencia de números
    for t in heatmap.texts:
        # Asegúrate de que todos los valores, incluyendo ceros, sean visibles
        val = float(t.get_text()) if t.get_text() else 0
        
        # Ajustar color del texto según el valor de fondo
        if val > 50:
            t.set_color('white')
        else:
            t.set_color('black')

    # Ajustar etiquetas
    plt.xticks(rotation=45, ha='right')
    plt.yticks(rotation=0)

    # Añadir título y ajustar
    plt.title('Matriz de Similitud de Card Sorting (%)', fontsize=16, pad=20)
    plt.tight_layout()

    # Guardar en el directorio especificado
    matrix_full_path = os.path.join(output_dir, 'matriz_similitud_completa.png')
    plt.savefig(matrix_full_path, dpi=300, bbox_inches='tight')
    
    # Guardar también como bytes para enviar al frontend
    image_bytes = BytesIO()
    plt.savefig(image_bytes, format='png', dpi=300, bbox_inches='tight')
    image_bytes.seek(0)
    base64_image = base64.b64encode(image_bytes.read()).decode('utf-8')
    
    # Añadir al diccionario de resultados
    result_images['matriz_completa'] = {
        'path': matrix_full_path,
        'base64': base64_image
    }
    
    plt.close()
    print("Matriz de similitud completa guardada.")

    # Ahora también crear la versión triangular pero explícitamente marcando los ceros
    mask = np.triu(np.ones_like(similarity_df, dtype=bool))

    plt.figure(figsize=(14, 12))
    ax = plt.subplot(111)

    # Crear mapa de calor con estilo mejorado, ahora en forma de escalera
    heatmap = sns.heatmap(similarity_df, 
                        mask=mask,
                        cmap=cmap,
                        square=True,
                        linewidths=.5,
                        cbar_kws={"shrink": .8, "label": "Similitud (%)"},
                        xticklabels=labels_short,
                        yticklabels=labels_short,
                        vmin=0, 
                        vmax=100,
                        annot=True,
                        fmt=".0f")

    # Mejorar apariencia de números
    for t in heatmap.texts:
        if not t.get_text():
            continue
        val = float(t.get_text())
        if val == 0:
            # Mantener los ceros visibles
            t.set_color('black')
        else:
            t.set_color('white' if val > 50 else 'black')

    plt.title('Matriz de Similitud de Card Sorting (%) - Formato Escalera', fontsize=16, pad=20)
    plt.tight_layout()
    
    # Guardar en el directorio especificado
    matrix_stair_path = os.path.join(output_dir, 'matriz_similitud_escalera.png')
    plt.savefig(matrix_stair_path, dpi=300, bbox_inches='tight')
    
    # Guardar también como bytes para enviar al frontend
    image_bytes = BytesIO()
    plt.savefig(image_bytes, format='png', dpi=300, bbox_inches='tight')
    image_bytes.seek(0)
    base64_image = base64.b64encode(image_bytes.read()).decode('utf-8')
    
    # Añadir al diccionario de resultados
    result_images['matriz_escalera'] = {
        'path': matrix_stair_path,
        'base64': base64_image
    }
    
    plt.close()
    print("Matriz de similitud en forma de escalera guardada.")

    # -------- DENDOGRAMA MEJORADO HORIZONTAL --------
    # Usar la distancia de similitud para el dendrograma 
    distance_matrix = 100 - similarity_percentage
    np.fill_diagonal(distance_matrix, 0)
    condensed_distance = squareform(distance_matrix)

    # Calcular el linkage con método promedio (más adecuado para card sorting)
    linked = linkage(condensed_distance, method='average')

    # Crear un dendrograma horizontal más atractivo con colores vibrantes
    plt.figure(figsize=(14, 10))

    # Definir un umbral más bajo para obtener más clusters y por tanto más colores
    umbral_color = 20

    # Definir una paleta de colores más vibrantes
    colores = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', 
            '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']

    # Crear dendrograma con colores y orientación horizontal
    dendro = dendrogram(
        linked,
        labels=label_list,
        orientation='right',
        leaf_font_size=10,
        color_threshold=umbral_color,
        above_threshold_color='#888888',
        link_color_func=lambda k: colores[k % len(colores)]
    )

    plt.title('Analysis - Dendrogram', fontsize=18, pad=20)
    plt.xlabel('Distance (Lower = Higher Similarity)', fontsize=12)
    plt.ylabel('Cards', fontsize=12)

    # Ajustar la cuadrícula para que sea más sutil pero útil
    plt.grid(axis='x', linestyle='--', alpha=0.5, color='#CCCCCC')

    # Mejorar aspecto general
    plt.axvline(x=umbral_color, c='gray', linestyle='--', alpha=0.3)
    plt.tight_layout()

    # Guardar en el directorio especificado
    dendrogram_path = os.path.join(output_dir, 'dendrograma_card_sorting.png')
    plt.savefig(dendrogram_path, dpi=300, bbox_inches='tight')
    
    # Guardar también como bytes para enviar al frontend
    image_bytes = BytesIO()
    plt.savefig(image_bytes, format='png', dpi=300, bbox_inches='tight')
    image_bytes.seek(0)
    base64_image = base64.b64encode(image_bytes.read()).decode('utf-8')
    
    # Añadir al diccionario de resultados
    result_images['dendrograma'] = {
        'path': dendrogram_path,
        'base64': base64_image
    }
    
    plt.close()
    print("Dendrograma guardado.")

    return result_images

# Si se ejecuta directamente como script, procesar el archivo proporcionado
if __name__ == "__main__":
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        output_dir = sys.argv[2] if len(sys.argv) > 2 else None
        images = generate_charts(file_path, output_dir)
        print(f"Imágenes generadas en: {', '.join(img['path'] for img in images.values())}")
    else:
        print("Uso: python py_chart_generator.py <ruta_del_archivo_excel> [<directorio_de_salida>]")