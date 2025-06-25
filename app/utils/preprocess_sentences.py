import json
import re

def preprocess_text(text: str) -> str:
    """문장을 전처리합니다.
    - 앞에 붙은 숫자와 점 제거 (예: "1. ", "2. ")
    - "-" 기호 제거
    - 앞뒤 공백 제거
    """
    # 숫자와 점으로 시작하는 패턴 제거
    text = re.sub(r'^\d+\.\s*', '', text)
    # "-" 기호로 시작하는 패턴 제거
    text = re.sub(r'^-\s*', '', text)
    # 앞뒤 공백 제거
    text = text.strip()
    return text

def preprocess_sentences():
    # JSON 파일 읽기
    with open('feature_descriptions.json', 'r', encoding='utf-8') as f:
        feature_descriptions = json.load(f)

    # 전처리된 문장들을 저장할 딕셔너리
    processed_sentences = {}

    # 각 feature별로 문장 전처리 및 중복 제거
    for feature, sentences in feature_descriptions.items():
        # 각 문장 전처리
        processed = [preprocess_text(s) for s in sentences]
        # 중복 제거 (순서 보존)
        seen = set()
        unique_sentences = []
        for s in processed:
            if s not in seen:
                unique_sentences.append(s)
                seen.add(s)
        processed_sentences[feature] = unique_sentences

    # 전처리된 문장들을 JSON 파일로 저장
    with open('example_sentences.json', 'w', encoding='utf-8') as f:
        json.dump(processed_sentences, f, ensure_ascii=False, indent=2)

    # 통계 출력
    print("\n=== 전처리 결과 ===")
    for feature, sentences in processed_sentences.items():
        print(f"\n{feature}:")
        print(f"- 문장 수: {len(sentences)}")
        print("- 예시 문장:")
        for i, sentence in enumerate(sentences[:3], 1):  # 각 feature의 처음 3개 문장만 출력
            print(f"  {i}. {sentence}")

    print("\n전처리 완료! 'example_sentences.json' 파일이 생성되었습니다.")

if __name__ == "__main__":
    preprocess_sentences() 