from __future__ import annotations

import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from agent import close_browser, extract_content, screenshot, search
from config import settings
from llm import analyze_page, summarize
from models import (
    BrowseRequest,
    BrowseResponse,
    BrowseResult,
    PageResult,
    TaskState,
    TaskStatus,
)

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

_tasks: dict[str, BrowseResult] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.screenshots_dir, exist_ok=True)
    logger.info("Agent service starting on %s:%s", settings.host, settings.port)
    yield
    await close_browser()
    logger.info("Agent service stopped")


app = FastAPI(
    title="AI Web Browsing Agent",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _process_browse(task_id: str, request: BrowseRequest) -> None:
    result = _tasks[task_id]
    try:
        result.status = TaskState.RUNNING
        logger.info("Processing browse task %s for query: %s", task_id, request.query[:100])

        is_url = request.query.startswith("http://") or request.query.startswith("https://")

        if is_url:
            page = await extract_content(request.query)
            result.page_results = [page]
        else:
            search_res = await search(request.query)
            result.search_results = search_res

            for sr in search_res.results[:settings.max_pages_per_request]:
                try:
                    page = await extract_content(sr.url)
                    result.page_results.append(page)
                except Exception as e:
                    logger.warning("Failed to extract %s: %s", sr.url, e)

        all_content = "\n\n".join(
            f"### {p.title}\n{p.content[:5000]}" for p in result.page_results if p.content
        )

        if all_content:
            result.summary = await summarize(all_content)
            result.analysis = await analyze_page(all_content, request.query)

        result.status = TaskState.COMPLETED
        logger.info("Task %s completed with %d pages", task_id, len(result.page_results))

    except Exception as e:
        result.status = TaskState.FAILED
        result.error = str(e)
        logger.error("Task %s failed: %s", task_id, e)
    finally:
        result.completed_at = datetime.utcnow()


@app.post("/browse", response_model=BrowseResponse)
async def browse(request: BrowseRequest) -> BrowseResponse:
    task_id = str(uuid.uuid4())
    result = BrowseResult(
        task_id=task_id,
        query=request.query,
        chat_id=request.chat_id,
        user_id=request.user_id,
    )
    _tasks[task_id] = result
    asyncio.create_task(_process_browse(task_id, request))

    return BrowseResponse(
        task_id=task_id,
        status=TaskState.PENDING,
        message=f"Browse task created for: {request.query[:100]}",
    )


@app.get("/browse/status/{task_id}", response_model=TaskStatus)
async def get_status(task_id: str) -> TaskStatus:
    result = _tasks.get(task_id)
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskStatus(
        task_id=result.task_id,
        status=result.status,
        progress=f"{len(result.page_results)} pages fetched" if result.page_results else None,
        error=result.error,
        created_at=result.created_at,
        completed_at=result.completed_at,
    )


@app.get("/browse/result/{task_id}")
async def get_result(task_id: str) -> dict:
    result = _tasks.get(task_id)
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    if result.status == TaskState.PENDING or result.status == TaskState.RUNNING:
        raise HTTPException(status_code=202, detail="Task still processing")
    if result.status == TaskState.FAILED:
        raise HTTPException(status_code=500, detail=result.error)

    return {
        "task_id": result.task_id,
        "query": result.query,
        "status": result.status.value,
        "search_results": result.search_results.model_dump() if result.search_results else None,
        "pages": [
            {"url": p.url, "title": p.title, "content": p.content[:5000], "screenshot": p.screenshot_path}
            for p in result.page_results
        ],
        "summary": result.summary,
        "analysis": result.analysis,
        "created_at": result.created_at.isoformat(),
        "completed_at": result.completed_at.isoformat() if result.completed_at else None,
    }


@app.get("/health")
async def health() -> dict:
    return {
        "status": "healthy",
        "tasks": len(_tasks),
        "running": sum(1 for t in _tasks.values() if t.status == TaskState.RUNNING),
    }


@app.get("/")
async def root() -> dict:
    return {"service": "AI Web Browsing Agent", "version": "1.0.0", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
