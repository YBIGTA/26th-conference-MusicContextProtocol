from fastapi import FastAPI
from app.api import recommend, thumbnail

app = FastAPI()
app.include_router(recommend.router)
app.include_router(thumbnail.router)