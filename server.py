from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import sys
import os
sys.path.append(os.path.dirname(__file__))
import recommendation

app = FastAPI()

class RecommendRequest(BaseModel):
    query: str
    top_k: Optional[int] = 20

class TrackInfo(BaseModel):
    track_name: str
    artist_name: str
    track_uri: Optional[str] = None
    recommend_score: float
    language: Optional[str] = None
    popularity: Optional[float] = None

@app.post("/recommend", response_model=List[TrackInfo])
def recommend_endpoint(req: RecommendRequest):
    # recommendation.py의 main 로직을 recommend_tracks 함수로 분리했다고 가정
    # 입력: query(str), top_k(int), 출력: List[dict]
    results = recommendation.recommend_tracks(req.query, req.top_k)
    return results
