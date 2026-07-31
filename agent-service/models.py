from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TaskState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class BrowseRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="Search query or URL to browse")
    chat_id: str = Field(..., min_length=1, max_length=100, description="Chat identifier")
    user_id: str = Field(..., min_length=1, max_length=100, description="User identifier")
    context: Optional[str] = Field(None, max_length=10000, description="Additional context for the request")


class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str


class SearchResults(BaseModel):
    query: str
    results: list[SearchResult]
    total: int = 0


class PageResult(BaseModel):
    url: str
    title: str = ""
    content: str = ""
    metadata: dict = Field(default_factory=dict)
    screenshot_path: Optional[str] = None
    fetched_at: datetime = Field(default_factory=_utcnow)


class BrowseResult(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    query: str
    chat_id: str
    user_id: str
    status: TaskState = TaskState.PENDING
    search_results: Optional[SearchResults] = None
    page_results: list[PageResult] = Field(default_factory=list)
    summary: Optional[str] = None
    analysis: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)
    completed_at: Optional[datetime] = None


class BrowseResponse(BaseModel):
    task_id: str
    status: TaskState
    message: str = ""


class TaskStatus(BaseModel):
    task_id: str
    status: TaskState
    progress: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
