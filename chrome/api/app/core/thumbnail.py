from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import base64
import os
import time
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

def extract_image_prompt_from_query(query: str) -> str:
    """
    Gemini LLM을 사용해 쿼리에서 이미지 생성에 적합한 프롬프트(키워드/묘사)를 추출합니다.
    """
    system_prompt = (
        "아래 사용자의 요청에서 실제 활동(예: 코딩, 운동, 공부 등)이 명확하면 그 활동을 시각적으로 잘 드러내는 영어 프롬프트를 1문장으로 만들어줘. "
        "만약 활동이 명확하지 않고, 분위기/감정/테마(예: 신남, 여름, 파티, 집중 등)만 있다면, 그 분위기나 감정을 시각적으로 잘 표현할 수 있는 영어 프롬프트를 1문장으로 만들어줘. "
        "음악 UI 요소(재생바, 음표 등)는 포함하지 말고, 활동 또는 분위기/감정/테마 자체가 잘 드러나게 해줘. "
        "예시1: '코딩할 때 듣기 좋은 음악 추천해줘.' → 'A dark, high-tech digital interface illuminated by glowing, intricate lines of code and flowing data.' "
        "예시2: '미치게 신나는 음악 추천해줘.' → 'A vibrant explosion of neon colors and dynamic abstract shapes, expressing wild excitement and energy.' "
    )
    full_prompt = f"{system_prompt}\n사용자 요청: {query}"
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_prompt,
            config=types.GenerateContentConfig(response_modalities=['TEXT'])
        )
        for part in response.candidates[0].content.parts:
            if part.text is not None:
                return part.text.strip()
        return query  # fallback
    except Exception as e:
        print(f"[Prompt Extraction Error] {e}")
        return query

def generate_thumbnail_from_query(query: str, save_dir: str = '.', prefix: str = 'playlist_thumbnail') -> str:
    """
    사용자 쿼리를 기반으로 Gemini LLM을 통해 이미지 프롬프트를 추출하고, 해당 프롬프트로 썸네일 이미지를 생성합니다.
    Args:
        query (str): 사용자 쿼리(예: '여름 노래 추천해줘')
        save_dir (str): 이미지 저장 디렉터리
        prefix (str): 저장 파일명 접두사
    Returns:
        str: 저장된 이미지 파일 경로 (실패 시 None)
    """
    image_prompt = extract_image_prompt_from_query(query)
    print(f"[LLM 프롬프트] 이미지 생성에 사용된 쿼리: {image_prompt}")
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash-preview-image-generation",
            contents=image_prompt,
            config=types.GenerateContentConfig(
                response_modalities=['TEXT', 'IMAGE']
            )
        )
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                filename = f"{prefix}_{int(time.time())}.png"
                filepath = os.path.join(save_dir, filename)
                image = Image.open(BytesIO(part.inline_data.data))
                image.save(filepath)
                return filepath
        return None
    except Exception as e:
        print(f"[Thumbnail Generation Error] {e}")
        return None

# 예시 실행 (테스트용)
if __name__ == "__main__":
    query = "카페에서 공부할 때 듣기 좋은 음악 추천해줘."
    path = generate_thumbnail_from_query(query)
    if path:
        print(f"썸네일 이미지가 생성되었습니다: {path}")
        img = Image.open(path)
        img.show()
    else:
        print("이미지 생성 실패")
