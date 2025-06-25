# 기능 추가 및 협업 가이드

이 프로젝트는 누구나 새로운 기능(추천 알고리즘, 썸네일 생성, 기타 API 등)을 쉽게 추가하고,  
자신의 브랜치에서 안전하게 개발할 수 있도록 설계되어 있습니다.

---

## 1. 브랜치 생성 및 작업 흐름

1. **새 브랜치 생성**
    ```bash
    git checkout -b feature/기능명
    ```
    - 예시: `feature/playlist-title`, `feature/thumbnail-ai`, `yourname/genre-recommend`

2. **기능 개발**
    - 아래 예시 구조에 따라 파일을 추가/수정합니다.

---

## 2. 기능 추가 예시

### 1) 새로운 API 엔드포인트 추가

- **app/api/** 폴더에 기능별 파일 생성  
  예: `app/api/playlist_title.py`

    ```python
    # app/api/playlist_title.py
    from fastapi import APIRouter
    from app.core import playlist_title
    from app.models.schemas import PlaylistTitleRequest, PlaylistTitleResponse

    router = APIRouter()

    @router.post("/generate_playlist_title", response_model=PlaylistTitleResponse)
    def generate_playlist_title_endpoint(req: PlaylistTitleRequest):
        return playlist_title.generate_title_and_description(req.query)
    ```

### 2) 핵심 로직 추가

- **app/core/** 폴더에 기능별 파일 생성  
  예: `app/core/playlist_title.py`

    ```python
    # app/core/playlist_title.py
    def generate_title_and_description(query: str):
        # ... 실제 구현 ...
        return {"title": "My Playlist", "description": "A playlist for ..."}
    ```

### 3) 모델/스키마 추가

- **app/models/schemas.py**에 요청/응답 모델 추가

    ```python
    from pydantic import BaseModel

    class PlaylistTitleRequest(BaseModel):
        query: str

    class PlaylistTitleResponse(BaseModel):
        title: str
        description: str
    ```

### 4) 라우터 등록

- **app/main.py**에서 라우터를 등록

    ```python
    from app.api import playlist_title
    app.include_router(playlist_title.router)
    ```

---

**자유롭게 기능을 추가하고, 브랜치에서 안전하게 개발한 뒤 PR을 보내주세요!**
