from pydantic import BaseModel
from typing import Optional, List

class RecommendRequest(BaseModel):
    query: str

class TrackInfo(BaseModel):
    track_name: str
    artist_name: str
    track_uri: Optional[str] = None
    recommend_score: float
    language: Optional[str] = None
    popularity: Optional[float] = None