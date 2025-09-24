from fastapi import APIRouter
from app.core import thumbnail
from app.models.schemas import RecommendRequest

router = APIRouter()

@router.post("/generate_thumbnail")
def generate_thumbnail_endpoint(req: RecommendRequest):
    path = thumbnail.generate_thumbnail_from_query(req.query)
    if path:
        return {"thumbnail_path": path}
    else:
        return {"error": "이미지 생성 실패"}