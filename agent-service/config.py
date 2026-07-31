from __future__ import annotations

import os
from dataclasses import dataclass, field
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    # LLM
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    openai_base_url: str = field(default_factory=lambda: os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"))
    openai_model: str = field(default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-4o-mini"))

    # Browser
    browser_timeout: int = field(default_factory=lambda: int(os.getenv("BROWSER_TIMEOUT", "30000")))
    max_pages_per_request: int = field(default_factory=lambda: int(os.getenv("MAX_PAGES_PER_REQUEST", "5")))
    headless: bool = field(default_factory=lambda: os.getenv("HEADLESS", "true").lower() == "true")

    # Security
    allowed_domains: list[str] = field(default_factory=lambda: [
        d.strip() for d in os.getenv("ALLOWED_DOMAINS", "").split(",") if d.strip()
    ])
    blocked_domains: list[str] = field(default_factory=lambda: [
        d.strip() for d in os.getenv("BLOCKED_DOMAINS", "").split(",") if d.strip()
    ])
    sandbox_mode: bool = field(default_factory=lambda: os.getenv("SANDBOX_MODE", "true").lower() == "true")
    # Shared secret required on every /browse request (X-Agent-Token header).
    # When empty, all browsing endpoints return 503 — the service must not run open.
    agent_token: str = field(default_factory=lambda: os.getenv("AGENT_TOKEN", "").strip())
    # Allow navigation to private/loopback/link-local addresses (SSRF guard).
    # Keep off unless the service must browse internal resources.
    allow_private_urls: bool = field(default_factory=lambda: os.getenv("ALLOW_PRIVATE_URLS", "false").lower() == "true")

    # Server
    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("PORT", "8080")))
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "info"))
    cors_origins: list[str] = field(default_factory=lambda: [
        o.strip() for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:4173,https://msg.hakerone.ru,"
            "https://msg.darkheavens.ru,https://n.hakerone.ru,https://n.darkheavens.ru,"
            "https://nexo.hakerone.ru,https://nexo.darkheavens.ru,"
            "https://xn--e1akhgo.hakerone.ru,https://xn--e1akhgo.darkheavens.ru",
        ).split(",") if o.strip()
    ])

    # Concurrency & lifecycle
    max_concurrent_tasks: int = field(default_factory=lambda: int(os.getenv("MAX_CONCURRENT_TASKS", "5")))
    max_tasks: int = field(default_factory=lambda: int(os.getenv("MAX_TASKS", "500")))
    task_ttl_seconds: int = field(default_factory=lambda: int(os.getenv("TASK_TTL_SECONDS", "3600")))

    # Output
    screenshots_dir: str = field(default_factory=lambda: os.getenv("SCREENSHOTS_DIR", "./screenshots"))

    def is_domain_allowed(self, host: str) -> bool:
        """Boundary-aware domain check: 'hakerone.ru' matches 'x.hakerone.ru'
        but NOT 'hakerone.ru.evil.com' or 'fakehakerone.ru'."""
        host = (host or "").lower().rstrip(".")
        if self.blocked_domains and any(
            host == d or host.endswith("." + d) for d in self.blocked_domains
        ):
            return False
        if self.allowed_domains:
            return any(
                host == d or host.endswith("." + d) for d in self.allowed_domains
            )
        return True


settings = Settings()
