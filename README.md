
---

## 서버 실행 방법

1. 의존성 설치  
   ```bash
   pip install -r requirements.txt
   ```

2. FastAPI 서버 실행  
   ```bash
   uvicorn server:app --reload
   ```

---

## 기능 추가 및 엔드포인트 확장 가이드

### 1. 새로운 기능을 **별도의 파이썬 파일**로 추가

- 예시:
  - `playlist_title.py` : 플레이리스트 제목/설명 생성
  - `mp3_extractor.py` : mp3 음원 추출
  - `playlist_thumbnail.py` : 플레이리스트 썸네일 생성

- 각 파일에 함수 및 필요한 클래스를 자유롭게 구현합니다.

### 2. FastAPI 엔드포인트 추가

- `server.py`에서 새 파일을 import하고, 엔드포인트를 추가합니다.

#### 예시:  
```python
# server.py
import playlist_title
import mp3_extractor
import playlist_thumbnail

@app.post("/generate_playlist_title")
def generate_playlist_title_endpoint(req: RecommendRequest):
    return playlist_title.generate_title_and_description(req.query, req.top_k)

@app.post("/extract_mp3")
def extract_mp3_endpoint(req: RecommendRequest):
    return mp3_extractor.extract_mp3(req.query, req.top_k)

@app.post("/generate_playlist_thumbnail")
def generate_playlist_thumbnail_endpoint(req: RecommendRequest):
    return playlist_thumbnail.generate_thumbnail(req.query, req.top_k)
```

- 필요에 따라 새로운 Request/Response 모델(BaseModel 상속)도 정의할 수 있습니다.

### 3. Pull Request/협업 시 권장 사항

- 각 파일/함수/엔드포인트별 docstring, 주석을 충분히 작성해 주세요.
- 새로운 기능은 반드시 **테스트** 후 PR을 올려 주세요.
- 데이터 파일이 커질 경우, git LFS 사용을 권장합니다.

---

## 예시: 새로운 기능 파일 및 엔드포인트 추가

1. `playlist_title.py`에 함수 추가:
   ```python
   def generate_title_and_description(query: str, top_k: int = 20):
       # ... 제목/설명 생성 로직 ...
       return {"title": "...", "description": "..."}
   ```

2. `server.py`에 엔드포인트 추가:
   ```python
   import playlist_title

   @app.post("/generate_playlist_title")
   def generate_playlist_title_endpoint(req: RecommendRequest):
       return playlist_title.generate_title_and_description(req.query, req.top_k)
   ```

---

## 기여 방법

1. 이 저장소를 fork 후, 기능을 추가하거나 버그를 수정합니다.
2. PR(Pull Request)을 생성해 주세요.
3. 코드 리뷰 및 테스트 후 main 브랜치에 병합됩니다.

---
