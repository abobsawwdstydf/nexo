from __future__ import annotations

import os
from dataclasses import dataclass, field

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

    # Server
    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("PORT", "8080")))
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "info"))
    cors_origins: list[str] = field(default_factory=lambda: [
        o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
    ])

    # Output
    screenshots_dir: str = field(default_factory=lambda: os.getenv("SCREENSHOTS_DIR", "./screenshots"))

    def is_domain_allowed(self, url: str) -> bool:
        from urllib.parse import urlparse
        host = urlparse(url).hostname or ""
        if self.blocked_domains and any(d in host for d in self.blocked_domains):
            return False
        if self.allowed_domains:
            return any(d in host for d in self.allowed_domains)
        return True


settings = Settings()
