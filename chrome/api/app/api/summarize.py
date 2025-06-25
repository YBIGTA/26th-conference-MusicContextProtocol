from fastapi import APIRouter
from pydantic import BaseModel
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# Upstage API 클라이언트 설정
client = OpenAI(
    api_key=os.getenv("UPSTAGE_API_KEY"),
    base_url="https://api.upstage.ai/v1"
)

class SummarizeRequest(BaseModel):
    content: str

class SummarizeResponse(BaseModel):
    summary: str

@router.post("/summarize", response_model=SummarizeResponse)
def summarize_content(req: SummarizeRequest):
    """
    웹페이지 내용을 한국어로 요약하고 분위기를 분석하는 엔드포인트
    """
    print(f"[SUMMARIZE] Received content length: {len(req.content)} characters")
    print(f"[SUMMARIZE] Content preview: {req.content[:100]}...")
    
    try:
        response = client.chat.completions.create(
            model="solar-pro",
            messages=[
                {
                    "role": "system",
                    "content": "당신은 웹페이지 내용을 분석하여 음악 추천에 적합한 분위기와 상황을 파악하는 전문가입니다. 사용자의 현재 활동과 감정 상태를 정확히 파악하여 간결하게 설명하세요."
                },
                {
                    "role": "user", 
                    "content": f"""현재 페이지의 내용을 한 줄로 요약하고 분위기를 설명하시오.

다음 웹페이지 내용을 분석하여:
1. 사용자가 무엇을 하고 있는지 (학습, 업무, 엔터테인먼트, 쇼핑 등)
2. 현재 분위기나 감정 상태 (집중, 휴식, 즐거움, 스트레스 등)
3. 어떤 음악이 어울릴지를 고려한 상황 설명

15단어 이하로 핵심만 간결하게 한국어로 답변하세요.

웹페이지 내용:
{req.content}

답변:"""
                }
            ],
            stream=False,
        )
        
        summary = response.choices[0].message.content.strip()
        print(f"[SUMMARIZE] Generated summary: {summary}")
        return SummarizeResponse(summary=summary)
        
    except Exception as e:
        print(f"Error summarizing content: {e}")
        # 더 지능적인 fallback 요약
        content_lower = req.content.lower()
        
        # 키워드 기반 분위기 감지
        if any(word in content_lower for word in ['news', '뉴스', 'breaking', '속보']):
            fallback_summary = "뉴스나 시사 내용을 읽는 중"
        elif any(word in content_lower for word in ['study', 'learn', '공부', '학습', 'tutorial']):
            fallback_summary = "학습이나 공부 관련 내용"
        elif any(word in content_lower for word in ['work', '업무', 'project', 'meeting']):
            fallback_summary = "업무나 작업 관련 활동"
        elif any(word in content_lower for word in ['game', '게임', 'play', 'fun']):
            fallback_summary = "게임이나 엔터테인먼트 활동"
        elif any(word in content_lower for word in ['shop', '쇼핑', 'buy', 'product']):
            fallback_summary = "쇼핑이나 제품 검색 중"
        else:
            # 간단한 텍스트 요약
            words = req.content.split()
            if len(words) > 8:
                fallback_summary = ' '.join(words[:8]) + " 관련 내용"
            else:
                fallback_summary = "일반적인 웹 탐색"
        
        print(f"[SUMMARIZE] Using fallback summary: {fallback_summary}")
        return SummarizeResponse(summary=fallback_summary)