import os
import json
import requests
from dotenv import load_dotenv
from typing import Dict, List, Set
import time

# .env 파일에서 API 키 로드
load_dotenv()

# Upstage API 키 설정
UPSTAGE_API_KEY = os.getenv("UPSTAGE_API_KEY")

SOLAR_API_URL = "https://api.upstage.ai/v1/solar/chat/completions"
SOLAR_MODEL = "solar-pro-250422"

def get_feature_description(feature: str) -> str:
    """각 피처에 대한 설명을 반환합니다."""
    descriptions = {
        'danceability': """춤추기 좋은 정도(danceability)는 음악이 얼마나 춤추기 좋은지를 나타내는 지표입니다.
        템포, 리듬의 안정성, 비트의 강도, 전체적인 규칙성 등을 기반으로 계산됩니다.
        값이 높을수록 춤추기 좋은 음악을 의미합니다.""",
        
        'energy': """에너지(energy)는 음악의 강도와 활동성을 나타내는 지표입니다.
        동적 범위, 지각된 음량, 음색, 시작 속도, 일반적인 엔트로피 등을 기반으로 계산됩니다.
        값이 높을수록 더 강렬하고 활기찬 음악을 의미합니다.""",
        
        'loudness': """음량(loudness)은 트랙의 전체 음량을 데시벨(dB) 단위로 나타낸 값입니다.
        값이 클수록 더 큰 소리를 의미합니다.
        일반적으로 -60dB에서 0dB 사이의 값을 가집니다.""",
        
        'speechiness': """말하는 정도(speechiness)는 트랙에 말하는 소리가 얼마나 포함되어 있는지를 나타내는 지표입니다.
        값이 높을수록 랩이나 말하는 소리가 더 많이 포함되어 있음을 의미합니다.""",
        
        'acousticness': """어쿠스틱한 정도(acousticness)는 트랙이 어쿠스틱한지 여부를 나타내는 지표입니다.
        값이 1.0에 가까울수록 더 어쿠스틱한 음악을 의미합니다.""",
        
        'instrumentalness': """기악적인 정도(instrumentalness)는 트랙에 보컬이 없는지 여부를 예측하는 지표입니다.
        값이 0.5보다 크면 보컬이 없을 가능성이 높고, 0.5에 가까울수록 보컬과 악기가 혼합되어 있을 가능성이 높습니다.""",
        
        'liveness': """라이브 느낌(liveness)은 트랙이 라이브 공연을 녹음했는지 여부를 나타내는 지표입니다.
        값이 높을수록 라이브 공연에서 녹음되었을 가능성이 높습니다.
        관객 소리의 존재가 이 값을 결정하는 데 중요한 요소입니다.""",
        
        'valence': """긍정적 감정(valence)은 트랙이 전달하는 음악적 긍정성을 나타내는 지표입니다.
        값이 높을수록 더 긍정적이고 행복한 느낌을, 낮을수록 더 부정적이고 슬프거나 화가 난 느낌을 줍니다.""",
        
        'tempo': """템포(tempo)는 트랙의 전체적인 추정 BPM(Beats Per Minute)을 나타냅니다.
        값이 클수록 더 빠른 템포를 의미합니다."""
    }
    return descriptions.get(feature, "")

def generate_sentences_for_category(feature: str, category: str, highlow: str, count: int) -> List[str]:
    """특정 카테고리와 high/low에 대한 문장들을 생성합니다."""
    feature_desc = get_feature_description(feature)
    prompt = f"""{feature_desc}\n\n{feature}가 {highlow} 음악의 {category}에 대한 짧은 문장 {count}개를 생성해주세요.\n각 문장은 이 음악의 특징, 분위기, 감정 중 하나를 간단히 설명하면 됩니다.\n문장은 짧고 명확해야 하며, 중복되지 않아야 합니다.\n각 문장은 새로운 줄에 작성해주세요."""

    headers = {
        "Authorization": f"Bearer {UPSTAGE_API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "model": SOLAR_MODEL,
        "messages": [
            {"role": "system", "content": "You are a music expert who can describe music features in Korean. Generate short, concise sentences that describe the characteristics, mood, or emotional impact of the music."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 1000,
        "temperature": 0.7
    }

    try:
        response = requests.post(SOLAR_API_URL, headers=headers, json=data)
        response.raise_for_status()
        result = response.json()
        sentences = [s.strip() for s in result["choices"][0]["message"]["content"].strip().split('\n') if s.strip()]
        return sentences
    except Exception as e:
        print(f"Error generating sentences for {feature} - {category} - {highlow}: {e}")
        return []

def generate_feature_descriptions() -> Dict[str, List[str]]:
    """각 오디오 피처별로 high/low 예시 문장 30개씩 생성합니다."""
    feature_categories = ['음악적 특징', '감정적 특징', '상황적 특징']
    feature_examples = {}
    for feature in [
        'danceability', 'energy', 'loudness', 'speechiness',
        'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo']:
        for highlow in ['높은', '낮은']:
            all_sentences = []
            for category in feature_categories:
                print(f"Generating {feature} {highlow} - {category}...")
                sentences = generate_sentences_for_category(feature, category, highlow, 10)
                all_sentences.extend(sentences)
            # 30개로 제한
            key = f"{feature}_{'high' if highlow == '높은' else 'low'}"
            feature_examples[key] = all_sentences[:30]
            print(f"Generated {len(feature_examples[key])} sentences for {feature} {highlow}")
    # JSON 파일로 저장
    with open('feature_descriptions.json', 'w', encoding='utf-8') as f:
        json.dump(feature_examples, f, ensure_ascii=False, indent=2)
    return feature_examples

def main():
    print("Generating feature descriptions...")
    feature_examples = generate_feature_descriptions()
    print("\nAll generated descriptions:")
    for feature, examples in feature_examples.items():
        print(f"\n{feature}:")
        for example in examples:
            print(f"- {example}")
    print("\nDescriptions have been saved to 'feature_descriptions.json'")

if __name__ == "__main__":
    main()
