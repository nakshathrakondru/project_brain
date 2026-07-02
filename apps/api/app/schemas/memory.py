import uuid
from datetime import datetime
from pydantic import BaseModel


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    sources: list[dict] = []
    conversation_id: uuid.UUID


class SearchRequest(BaseModel):
    q: str
    limit: int = 10


class SearchResult(BaseModel):
    node_id: str
    node_type: str
    title: str
    snippet: str
    score: float | None = None


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
