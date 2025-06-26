#!/usr/bin/env python3


import json, os, sys
from textwrap import dedent

# ──────────────────────────────────────────────────────────────
# Upstage Solar(OpenAI v1 호환) 클라이언트
# ──────────────────────────────────────────────────────────────
try:
    from openai import OpenAI
except ImportError:
    import requests
    class _FallbackClient:
        def __init__(self, api_key, base_url):
            self._key  = api_key
            self._base = base_url.rstrip("/")
        def chat_completion(self, messages, model):
            url = f"{self._base}/chat/completions"
            body = {
                "model": model,
                "messages": messages,
                "temperature": 0.8,
                "max_tokens": 128,
                "response_format": {"type": "json_object"},
            }
            r = requests.post(
                url,
                headers={"Authorization": f"Bearer {self._key}",
                         "Content-Type": "application/json"},
                json=body, timeout=30)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

# ──────────────────────────────────────────────────────────────
# 환경 변수 / 상수
# ──────────────────────────────────────────────────────────────
API_KEY  = os.getenv("UPSTAGE_API_KEY")
BASE_URL = "https://api.upstage.ai/v1/solar"
MODEL_ID = "solar-1-mini-chat"

# ──────────────────────────────────────────────────────────────
# 시스템 프롬프트 — 사용자 요구사항 전부 반영
# ──────────────────────────────────────────────────────────────
SYSTEM_GUIDELINES = dedent("""
    당신은 음악 스트리밍 서비스의 플레이리스트 에디터 전문가입니다.
    아래 통계 분석(Feature 유사도, 상위 3개 feature 방향성, 추천 곡 20곡)을
    읽고 **플레이리스트 제목(25자 이하)** 과 **설명(234자 이하)** 을 작성하십시오.

    규칙
    1. ‘상위 3개 feature’의 방향성(high / low)을 종합해 전반적 분위기를 잡습니다.
       예시) danceability·valence·tempo가 모두 high → 경쾌‧신나는 느낌
    2. 제목에는 **어떤 곡명도 포함하지 마십시오**. 설명에는 곡명을 넣어도, 넣지 않아도 됩니다.
    3. 20곡의 언어·아티스트·분위기를 참고해 설득력을 더하되,
       곡명을 나열하지 말고 ‘글로벌 팝·케이팝’ 등으로 간결히 요약해도 무방합니다.
    4. **맞춤법을 지킵니다**(예: ‘히트’ ✔, ‘힛트’ ✘). 과도한 줄임말·신조어는 피해 주세요.
    5. 설명은 완결형 문장으로 마무리하며 “~한 ~리스트입니다” 형태를 권장합니다.
       60~100자 범위 내에서 매력적으로 작성하십시오.
    6. 출력은 반드시 **순수 JSON** 형식:
       { "title": "<제목>", "description": "<설명>" }
       따옴표·마크다운·추가 키를 포함하면 실패로 간주됩니다.
    7. 위 조건을 하나라도 어기면 잘못된 출력으로 처리합니다.
""").strip()

# ──────────────────────────────────────────────────────────────
def build_messages(block: str):
    return [
        {"role": "system", "content": SYSTEM_GUIDELINES},
        {"role": "user",
         "content": ("--- INPUT DATA ---\n"
                     + block.strip()
                     + "\n------------------\n"
                     + "Now respond with the JSON object only.")},
    ]

def read_stats_block() -> str:
    """STDIN 이 비어 있으면 ./input.txt 를 자동 사용"""
    if not sys.stdin.isatty():                          # 파이프/리다이렉션?
        data = sys.stdin.read()
        if data.strip():
            return data
    here = os.path.dirname(os.path.abspath(__file__))
    candidate = os.path.join(here, "input.txt")
    try:
        with open(candidate, encoding="utf-8") as f:
            data = f.read()
            if data.strip():
                return data
    except FileNotFoundError:
        pass
    sys.exit("X")

# ──────────────────────────────────────────────────────────────
def main():
    stats = read_stats_block()
    messages = build_messages(stats)

    if 'OpenAI' in globals() and OpenAI is not None:
        client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
        completion = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            temperature=0.8,
            max_tokens=128,
            response_format={"type": "json_object"},
        ).choices[0].message.content
    else:
        completion = _FallbackClient(API_KEY, BASE_URL).chat_completion(
            messages, model=MODEL_ID)

    # JSON 유효성 검사
    try:
        parsed = json.loads(completion)
        assert {"title", "description"} <= parsed.keys()
    except Exception as e:
        sys.exit(f"❌  LLM returned invalid JSON: {e}\n---\n{completion}")

    print(json.dumps(parsed, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
