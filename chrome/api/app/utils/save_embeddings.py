import numpy as np
import json
import time
from openai import OpenAI
from dotenv import load_dotenv
import os

# .env 파일에서 API 키 로드
load_dotenv()
UPSTAGE_API_KEY = os.getenv("UPSTAGE_API_KEY")

# Upstage API 클라이언트 설정
client = OpenAI(
    api_key=UPSTAGE_API_KEY,
    base_url="https://api.upstage.ai/v1"
)

def embed_sentences(sentences, model="embedding-passage"):
    """
    Upstage Solar 임베딩 API를 통해 문장 리스트의 임베딩을 생성합니다.
    """
    try:
        response = client.embeddings.create(
            input=sentences,
            model=model
        )
        return [item.embedding for item in response.data]
    except Exception as e:
        print(f"Error during embedding: {e}")
        return []

def save_embeddings_to_json():
    """
    example_sentences.json의 feature별 문장 리스트를 임베딩하여
    feature_embeddings.json에 저장합니다.
    """
    # 전처리된 문장 로드
    with open('example_sentences.json', 'r', encoding='utf-8') as f:
        feature_sentences = json.load(f)
    
    feature_embeddings = {}
    batch_size = 32
    print("Solar Embedding 생성 중...")
    
    for feature, sentences in feature_sentences.items():
        print(f"\n{feature} 피처 처리 중... ({len(sentences)}개 문장)")
        embeddings = []
        for i in range(0, len(sentences), batch_size):
            batch = sentences[i:i+batch_size]
            batch_embeddings = embed_sentences(batch)
            embeddings.extend(batch_embeddings)
            print(f"  - 배치 {i//batch_size + 1} 완료: {len(batch)}개 문장")
            # API 과부하 방지
            # time.sleep(0.5)
        feature_embeddings[feature] = embeddings
        print(f"  - 임베딩 완료: {len(embeddings)}개, 차원: {len(embeddings[0]) if embeddings else 0}")
    # JSON 파일로 저장
    with open('feature_embeddings.json', 'w', encoding='utf-8') as f:
        json.dump(feature_embeddings, f, ensure_ascii=False, indent=2)
    # 통계 출력
    print("\n=== Feature별 통계 ===")
    for feature, embeddings in feature_embeddings.items():
        print(f"\n{feature}:")
        print(f"- 임베딩 수: {len(embeddings)}")
        print(f"- 임베딩 차원: {len(embeddings[0]) if embeddings else 0}")
    print("\nJSON 파일로 저장 완료!")

if __name__ == "__main__":
    save_embeddings_to_json() 