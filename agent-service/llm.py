from __future__ import annotations

import logging
from typing import AsyncIterator

from openai import AsyncOpenAI

from config import settings

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.openai_api_key or "sk-placeholder",
            base_url=settings.openai_base_url,
            timeout=60.0,
        )
    return _client


async def _chat(
    messages: list[dict],
    temperature: float = 0.3,
    max_tokens: int = 2048,
    stream: bool = False,
) -> str | AsyncIterator[str]:
    client = get_client()
    try:
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
        )
        if stream:
            return _stream_response(response)
        return response.choices[0].message.content or ""
    except Exception as e:
        logger.error("LLM call failed: %s", e)
        raise


async def _stream_response(response) -> AsyncIterator[str]:
    async for chunk in response:
        delta = chunk.choices[0].delta if chunk.choices else None
        if delta and delta.content:
            yield delta.content


async def analyze_page(content: str, query: str) -> str:
    messages = [
        {"role": "system", "content": (
            "You are an AI web browsing assistant. Analyze web page content and extract "
            "relevant information for the user's query. Be concise and factual."
        )},
        {"role": "user", "content": (
            f"Query: {query}\n\nPage content:\n{content[:15000]}"
        )},
    ]
    return await _chat(messages, temperature=0.2, max_tokens=1024)


async def summarize(content: str, max_tokens: int = 500) -> str:
    messages = [
        {"role": "system", "content": "Summarize the following content concisely in 2-4 sentences."},
        {"role": "user", "content": content[:20000]},
    ]
    return await _chat(messages, temperature=0.3, max_tokens=max_tokens)


async def suggest_replies(context: str) -> list[str]:
    messages = [
        {"role": "system", "content": (
            "Based on the browsing context, suggest 3 short reply messages the user "
            "could send in a chat. Return ONLY a JSON array of strings, no other text."
        )},
        {"role": "user", "content": context[:10000]},
    ]
    raw = await _chat(messages, temperature=0.7, max_tokens=300)
    import json
    try:
        replies = json.loads(raw)
        return replies if isinstance(replies, list) else [raw]
    except json.JSONDecodeError:
        return [line.strip("- ").strip('"') for line in raw.strip().splitlines() if line.strip()]


async def translate(text: str, target_lang: str = "en") -> str:
    messages = [
        {"role": "system", "content": f"Translate the following text to {target_lang}. Output ONLY the translation."},
        {"role": "user", "content": text},
    ]
    return await _chat(messages, temperature=0.1, max_tokens=2048)


async def moderate_content(text: str) -> dict:
    messages = [
        {"role": "system", "content": (
            "Analyze text for spam, toxicity, or policy violations. "
            "Return JSON: {\"safe\": bool, \"flags\": [str], \"reason\": str}"
        )},
        {"role": "user", "content": text[:5000]},
    ]
    import json
    raw = await _chat(messages, temperature=0.0, max_tokens=200)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"safe": True, "flags": [], "reason": "analysis_failed"}


async def stream_analyze(content: str, query: str) -> AsyncIterator[str]:
    messages = [
        {"role": "system", "content": (
            "You are an AI web browsing assistant. Analyze web page content and stream "
            "relevant information for the user's query."
        )},
        {"role": "user", "content": f"Query: {query}\n\nPage content:\n{content[:15000]}"},
    ]
    result = await _chat(messages, temperature=0.2, max_tokens=1024, stream=True)
    if isinstance(result, AsyncIterator):
        async for chunk in result:
            yield chunk
