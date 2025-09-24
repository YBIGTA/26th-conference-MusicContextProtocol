from fastapi import APIRouter
from app.core import recommendation
from app.models.schemas import RecommendRequest, TrackInfo

router = APIRouter()

@router.post("/recommend", response_model=list[TrackInfo])
def recommend_endpoint(req: RecommendRequest):
    results = recommendation.recommend_tracks(req.query)
    return results