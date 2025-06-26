import os
import json
import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
from typing import List, Tuple, Dict
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd

# .env 파일에서 API 키 로드
load_dotenv()

# Upstage API 클라이언트 설정
client = OpenAI(
    api_key=os.getenv("UPSTAGE_API_KEY"),
    base_url="https://api.upstage.ai/v1"
)

# 데이터 파일 경로를 모듈 상단에서 정의
base_dir = os.path.dirname(os.path.abspath(__file__))  # .../app/core
data_dir = os.path.abspath(os.path.join(base_dir, "..", "data"))  # .../app/data

def get_embedding(text: str) -> List[float]:
    """단일 텍스트의 임베딩을 반환합니다."""
    try:
        response = client.embeddings.create(
            model="embedding-passage",
            input=[text]
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Error getting embedding for text: {e}")
        return []

def load_saved_data() -> Tuple[Dict, Dict]:
    """저장된 데이터를 불러옵니다."""
    # example_sentences.json 파일에서 문장들 불러오기
    with open(os.path.join(data_dir, 'example_sentences.json'), 'r', encoding='utf-8') as f:
        feature_sentences = json.load(f)
    # feature_embeddings.json 파일에서 임베딩 불러오기
    with open(os.path.join(data_dir, 'feature_embeddings.json'), 'r', encoding='utf-8') as f:
        feature_embeddings = json.load(f)
    return feature_sentences, feature_embeddings

def find_similar_sentences(query: str, feature_sentences: Dict, feature_embeddings: Dict, top_k: int = 50) -> List[Tuple[str, str, float]]:
    """쿼리와 유사한 문장들을 찾습니다."""
    # 쿼리 임베딩
    query_embedding = get_embedding(query)
    if not query_embedding:
        return []
    
    all_similarities = []
    
    # 각 feature별로 유사도 계산
    for feature, embeddings in feature_embeddings.items():
        sentences = feature_sentences[feature]
        
        for i, embedding in enumerate(embeddings):
            # 코사인 유사도 계산
            similarity = cosine_similarity([query_embedding], [embedding])[0][0]
            all_similarities.append((feature, sentences[i], similarity))
    
    # 유사도가 높은 순으로 정렬
    all_similarities.sort(key=lambda x: x[2], reverse=True)
    
    return all_similarities[:top_k]

def calculate_feature_scores_with_examples(query: str, feature_sentences: Dict, feature_embeddings: Dict) -> List[Tuple[str, float, List[Tuple[str, float]]]]:
    """쿼리 문장의 각 feature별 점수와 top 3 예시 문장 및 유사도를 반환합니다."""
    # 쿼리 임베딩
    query_embedding = get_embedding(query)
    if not query_embedding:
        return []
    
    feature_scores = []
    
    # 각 feature별로 유사도가 높은 문장 3개의 평균 계산 및 예시 반환
    for feature, embeddings in feature_embeddings.items():
        similarities = []
        sentences = feature_sentences[feature]
        
        for i, embedding in enumerate(embeddings):
            similarity = cosine_similarity([query_embedding], [embedding])[0][0]
            similarities.append((sentences[i], similarity))
        
        # 유사도가 높은 순으로 정렬하고 상위 3개만 선택
        similarities.sort(key=lambda x: x[1], reverse=True)
        top_3 = similarities[:3]
        avg_similarity = np.mean([sim for _, sim in top_3])
        feature_scores.append((feature, avg_similarity, top_3))
    
    # 유사도가 높은 순으로 정렬
    feature_scores.sort(key=lambda x: x[1], reverse=True)
    
    return feature_scores

def calculate_feature_sim_high_low(query: str, feature_sentences: Dict, feature_embeddings: Dict, n_avg: int = 5) -> Dict[str, Tuple[float, float]]:
    """
    각 feature별로 쿼리와 '높다'/'낮다' 예시 임베딩의 평균과의 유사도(sim_high, sim_low)를 반환.
    n_avg: 상위 n개 예시의 평균 유사도 사용
    반환: {feature: (sim_high, sim_low)}
    """
    query_embedding = get_embedding(query)
    if not query_embedding:
        return {}
    feature_sim = {}
    for feature in [
        'danceability', 'energy', 'loudness', 'speechiness',
        'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo']:
        # high
        high_key = f"{feature}_high"
        low_key = f"{feature}_low"
        if high_key not in feature_sentences or low_key not in feature_sentences:
            continue
        high_embeddings = feature_embeddings[high_key]
        low_embeddings = feature_embeddings[low_key]
        # 각 예시 임베딩과 쿼리 임베딩의 유사도 계산
        sim_highs = [cosine_similarity([query_embedding], [emb])[0][0] for emb in high_embeddings]
        sim_lows = [cosine_similarity([query_embedding], [emb])[0][0] for emb in low_embeddings]
        # 상위 n개 평균
        sim_highs.sort(reverse=True)
        sim_lows.sort(reverse=True)
        sim_high = np.mean(sim_highs[:n_avg])
        sim_low = np.mean(sim_lows[:n_avg])
        feature_sim[feature] = (sim_high, sim_low)
    return feature_sim

def recommend_tracks(query: str, top_k: int = 20):
    feature_sentences, feature_embeddings = load_saved_data()
    feature_sim = calculate_feature_sim_high_low(query, feature_sentences, feature_embeddings, n_avg=5)
    feature_relevance = []
    for feature, (sim_high, sim_low) in feature_sim.items():
        if sim_high > sim_low:
            feature_relevance.append((feature, sim_high, 'high'))
        else:
            feature_relevance.append((feature, sim_low, 'low'))
    feature_relevance.sort(key=lambda x: x[1], reverse=True)
    top_features = feature_relevance[:3]

    # --- 터미널에 출력 ---
    print("\n[Feature별 유사도 (sim_high, sim_low)]")
    for feature, (sim_high, sim_low) in feature_sim.items():
        print(f"{feature}: sim_high={sim_high:.4f}, sim_low={sim_low:.4f}")

    print("\n[상위 3개 feature 및 방향성]")
    for feature, relevance, direction in top_features:
        print(f"{feature}: {direction} (relevance={relevance:.4f})")
    # -------------------

    csv_path = os.path.join(data_dir, "spotify_tracknames_updated.csv")
    df = pd.read_csv(csv_path)

    def get_normalized_value(row, feature):
        value = row[feature]
        if pd.isnull(value):
            return 0
        if feature == 'loudness':
            return max(0, min(1, (float(value) + 45.92) / 46.672))
        elif feature == 'tempo':
            return max(0, min(1, float(value) / 232.198))
        else:
            return float(value)

    def calc_track_score(row):
        score = 0
        for feature, relevance, direction in top_features:
            value = get_normalized_value(row, feature)
            if direction == 'high':
                score += relevance * value
            else:
                score += relevance * (1 - value)
        return score

    df["recommend_score"] = df.apply(calc_track_score, axis=1)
    if 'language' in df.columns:
        df = df[df['language'].isin(['English', 'Korean'])]
    if 'popularity' in df.columns:
        df = df[df['popularity'] >= 20]
    df_sorted = df.sort_values("recommend_score", ascending=False)
    def get_title(row):
        return row["track_name"] if "track_name" in row and pd.notnull(row["track_name"]) else row["name"] if "name" in row and pd.notnull(row["name"]) else "Unknown"
    def get_artist(row):
        return row["artist_name"] if "artist_name" in row and pd.notnull(row["artist_name"]) else row["artists"] if "artists" in row and pd.notnull(row["artists"]) else "Unknown"
    df_top = df_sorted.head(500).copy()
    df_top['__title__'] = df_top.apply(get_title, axis=1)
    df_top = df_top.drop_duplicates(subset='__title__', keep='first')
    df_top['__artist__'] = df_top.apply(get_artist, axis=1)
    df_top = df_top.drop_duplicates(subset='__artist__', keep='first')
    top_n = df_top.head(top_k)

    results = []
    for _, row in top_n.iterrows():
        results.append({
            "track_name": get_title(row),
            "artist_name": get_artist(row),
            "track_uri": row.get("track_url", None),
            "recommend_score": row["recommend_score"],
            "language": row.get("language", None),
            "popularity": row.get("popularity", None)
        })
    return results

def main():
    # 저장된 데이터 로드
    print("Loading saved data...")
    feature_sentences, feature_embeddings = load_saved_data()
    
    # 사용자 쿼리 입력
    query = input("\n문장을 입력하세요: ")
    
    # Feature별 sim_high, sim_low 계산
    print("\n=== Feature별 쿼리-예시 유사도 (높다/낮다) ===")
    feature_sim = calculate_feature_sim_high_low(query, feature_sentences, feature_embeddings, n_avg=5)
    
    # --- input.txt 저장용 추가 시작 ---
    output_lines: List[str] = []
    output_lines.append("\n=== Feature별 쿼리-예시 유사도 (높다/낮다) ===")
    # --- input.txt 저장용 추가 끝 ---
    
    for feature, (sim_high, sim_low) in feature_sim.items():
        line = f"[{feature}] sim_high: {sim_high:.4f}, sim_low: {sim_low:.4f}"
        print(line)
        # --- input.txt 저장용 추가 ---
        output_lines.append(line)
        # --------------------------------

    # === 상위 3개 feature만 사용 ===
    feature_relevance = []
    for feature, (sim_high, sim_low) in feature_sim.items():
        if sim_high > sim_low:
            feature_relevance.append((feature, sim_high, 'high'))
        else:
            feature_relevance.append((feature, sim_low, 'low'))
    feature_relevance.sort(key=lambda x: x[1], reverse=True)
    top_features = feature_relevance[:3]
    print("\n=== 추천에 사용된 상위 3개 feature 및 방향성 ===")
    
    # --- input.txt 저장용 추가 ---
    output_lines.append("\n=== 추천에 사용된 상위 3개 feature 및 방향성 ===")
    # --------------------------------
    
    for feature, relevance, direction in top_features:
        line = f"{feature}: {direction} (relevance={relevance:.4f})"
        print(line)
        # --- input.txt 저장용 추가 ---
        output_lines.append(line)
        # --------------------------------

    # === 음악 추천 ===
    print("\n=== 쿼리 기반 음악 추천 Top 20 ===")
    
    # --- input.txt 저장용 추가 ---
    output_lines.append("\n=== 쿼리 기반 음악 추천 Top 20 ===")
    # --------------------------------
    
    # 1. CSV 로드
    csv_path = os.path.join(data_dir, "spotify_tracknames_updated.csv")
    df = pd.read_csv(csv_path)

    def get_normalized_value(row, feature):
        value = row[feature]
        if pd.isnull(value):
            return 0
        if feature == 'loudness':
            return max(0, min(1, (float(value) + 45.92) / 46.672))
        elif feature == 'tempo':
            return max(0, min(1, float(value) / 232.198))
        else:
            return float(value)

    def calc_track_score(row):
        score = 0
        for feature, relevance, direction in top_features:
            value = get_normalized_value(row, feature)
            if direction == 'high':
                score += relevance * value
            else:
                score += relevance * (1 - value)
        return score

    df["recommend_score"] = df.apply(calc_track_score, axis=1)
    # 언어가 영어(English) 또는 한국어(Korean)인 곡만, popularity 20 이상만 필터링
    if 'language' in df.columns:
        df = df[df['language'].isin(['English', 'Korean'])]
    if 'popularity' in df.columns:
        df = df[df['popularity'] >= 20]
    df_sorted = df.sort_values("recommend_score", ascending=False)
    # 충분히 많은 곡(500개)에서 제목+아티스트 기준 중복 제거 후 20개 추출
    def get_title(row):
        return row["track_name"] if "track_name" in row and pd.notnull(row["track_name"]) else row["name"] if "name" in row and pd.notnull(row["name"]) else "Unknown"
    def get_artist(row):
        return row["artist_name"] if "artist_name" in row and pd.notnull(row["artist_name"]) else row["artists"] if "artists" in row and pd.notnull(row["artists"]) else "Unknown"
    df_top = df_sorted.head(500).copy()
    df_top['__title__'] = df_top.apply(get_title, axis=1)
    df_top = df_top.drop_duplicates(subset='__title__', keep='first')
    df_top['__artist__'] = df_top.apply(get_artist, axis=1)
    df_top = df_top.drop_duplicates(subset='__artist__', keep='first')
    top_20 = df_top.head(20)

    # 3. 추천 결과 출력 (곡명, 아티스트, 점수)
    for idx, row in top_20.iterrows():
        title = row["track_name"] if "track_name" in row else row["name"] if "name" in row else "Unknown"
        artist = row["artist_name"] if "artist_name" in row else row["artists"] if "artists" in row else "Unknown"
        score = row["recommend_score"]
        lang = row["language"] if "language" in row else "?"
        pop = row["popularity"] if "popularity" in row else "?"
        line = f"{idx+1}. {title} - {artist} (추천 점수: {score:.4f}, 언어: {lang}, popularity: {pop})"
        print(line)
        # --- input.txt 저장용 추가 ---
        output_lines.append(line)
        # --------------------------------
    
    # --- input.txt 저장용 추가: 파일로 쓰기 ----------------------------
    txt_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "input.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines))
    print(f"\n📁 결과를 '{txt_path}' 에 저장했습니다.")
    # -----------------------------------------------------------------

if __name__ == "__main__":
    main() 
