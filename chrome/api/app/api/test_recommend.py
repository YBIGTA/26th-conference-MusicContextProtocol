from fastapi import APIRouter
from app.models.schemas import RecommendRequest, TrackInfo

router = APIRouter()

@router.post("/test-recommend", response_model=list[TrackInfo])
def test_recommend_endpoint(req: RecommendRequest):
    """
    Test endpoint that returns dummy music recommendations
    """
    # Return dummy tracks based on query keywords
    query_lower = req.query.lower()
    
    if "study" in query_lower or "programming" in query_lower or "work" in query_lower:
        return [
            TrackInfo(
                track_name="Focus Flow",
                artist_name="Lo-Fi Study Beats",
                track_uri="spotify:track:test1",
                recommend_score=0.95,
                language="Instrumental",
                popularity=75.0
            ),
            TrackInfo(
                track_name="Coding Jazz",
                artist_name="Programming Cafe",
                track_uri="spotify:track:test2",
                recommend_score=0.90,
                language="Instrumental", 
                popularity=68.0
            ),
            TrackInfo(
                track_name="Deep Work",
                artist_name="Ambient Focus",
                track_uri="spotify:track:test3",
                recommend_score=0.85,
                language="Instrumental",
                popularity=72.0
            )
        ]
    elif "relax" in query_lower or "chill" in query_lower:
        return [
            TrackInfo(
                track_name="Ocean Waves",
                artist_name="Nature Sounds",
                track_uri="spotify:track:test4",
                recommend_score=0.92,
                language="Instrumental",
                popularity=80.0
            ),
            TrackInfo(
                track_name="Peaceful Mind",
                artist_name="Meditation Music",
                track_uri="spotify:track:test5",
                recommend_score=0.88,
                language="Instrumental",
                popularity=65.0
            )
        ]
    else:
        return [
            TrackInfo(
                track_name="Generic Background Music",
                artist_name="Various Artists",
                track_uri="spotify:track:test6",
                recommend_score=0.70,
                language="English",
                popularity=60.0
            ),
            TrackInfo(
                track_name="Ambient Soundscape",
                artist_name="Background Music Co.",
                track_uri="spotify:track:test7",
                recommend_score=0.65,
                language="Instrumental",
                popularity=55.0
            )
        ]