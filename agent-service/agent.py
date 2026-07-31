from __future__ import annotations

import asyncio
import ipaddress
import logging
import os
import re
import socket
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlencode, urlparse

from playwright.async_api import (
    Browser,
    BrowserContext,
    Page,
    Playwright,
    async_playwright,
)

from config import settings
from models import PageResult, SearchResults, SearchResult

logger = logging.getLogger(__name__)

_playwright: Playwright | None = None
_browser: Browser | None = None
_semaphore = asyncio.Semaphore(settings.max_pages_per_request)


def _is_private_host(host: str) -> bool:
    """True for loopback, private, link-local and other non-public IPs."""
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        # Hostname — resolve it (asyncio-safe thread for DNS)
        try:
            infos = socket.getaddrinfo(host, None)
        except socket.gaierror:
            # Unresolvable host: let the browser fail naturally, do not block
            return False
        for info in infos:
            try:
                if ipaddress.ip_address(info[4][0]).is_private:
                    return True
            except ValueError:
                continue
        return False
    return addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved


def _validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Unsupported scheme: {parsed.scheme}")
    host = parsed.hostname or ""
    if not host:
        raise ValueError("Missing hostname")
    if not settings.is_domain_allowed(host):
        raise ValueError(f"Domain not allowed: {host}")
    if not settings.allow_private_urls and _is_private_host(host):
        raise ValueError(f"Private/internal address not allowed: {host}")
    return url


def _check_final_url(final_url: str) -> None:
    """SSRF guard: a page may redirect anywhere, so re-validate the final URL."""
    parsed = urlparse(final_url)
    host = parsed.hostname or ""
    if not host:
        raise ValueError("Navigation failed (no hostname)")
    if not settings.is_domain_allowed(host):
        raise ValueError(f"Redirected to disallowed domain: {host}")
    if not settings.allow_private_urls and _is_private_host(host):
        raise ValueError(f"Redirected to private address: {host}")


async def get_browser() -> Browser:
    global _playwright, _browser
    if _browser is None or not _browser.is_connected():
        _playwright = await async_playwright().start()
        _browser = await _playwright.chromium.launch(
            headless=settings.headless,
            args=[
                "--disable-gpu",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--disable-background-networking",
            ],
        )
        logger.info("Browser launched (headless=%s)", settings.headless)
    return _browser


async def close_browser() -> None:
    global _playwright, _browser
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright:
        await _playwright.stop()
        _playwright = None
    logger.info("Browser closed")


async def _new_context() -> BrowserContext:
    browser = await get_browser()
    return await browser.new_context(
        viewport={"width": 1280, "height": 720},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        ),
        java_script_enabled=not settings.sandbox_mode,
    )


async def navigate(url: str) -> PageResult:
    url = _validate_url(url)
    async with _semaphore:
        ctx = await _new_context()
        page: Page | None = None
        try:
            page = await ctx.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=settings.browser_timeout)
            await page.wait_for_load_state("networkidle", timeout=min(settings.browser_timeout, 10000))
            # SSRF guard: re-validate the final URL after any redirects
            _check_final_url(page.url)
            title = await page.title()
            return PageResult(
                url=page.url,
                title=title,
                metadata={"status": page.url},
            )
        except Exception as e:
            logger.error("navigate(%s) failed: %s", url, e)
            raise
        finally:
            if page:
                await page.close()
            await ctx.close()


async def search(query: str) -> SearchResults:
    async with _semaphore:
        ctx = await _new_context()
        page: Page | None = None
        try:
            page = await ctx.new_page()
            encoded = urlencode({"q": query})
            search_url = f"https://www.google.com/search?{encoded}&hl=en"
            await page.goto(search_url, wait_until="domcontentloaded", timeout=settings.browser_timeout)

            results: list[SearchResult] = []
            links = await page.query_selector_all("div.g")
            for link in links[:8]:
                try:
                    anchor = await link.query_selector("a")
                    title_el = await link.query_selector("h3")
                    snippet_el = await link.query_selector("div.VwiC3b, span.aCOpRe")
                    if anchor and title_el:
                        href = await anchor.get_attribute("href") or ""
                        title = await title_el.inner_text()
                        snippet = await snippet_el.inner_text() if snippet_el else ""
                        if href.startswith("/url?"):
                            import re as _re
                            m = _re.search(r"q=([^&]+)", href)
                            href = m.group(1) if m else href
                        if href.startswith("http"):
                            results.append(SearchResult(title=title.strip(), url=href, snippet=snippet.strip()))
                except Exception:
                    continue

            return SearchResults(query=query, results=results, total=len(results))
        except Exception as e:
            logger.error("search(%s) failed: %s", query, e)
            raise
        finally:
            if page:
                await page.close()
            await ctx.close()


async def extract_content(url: str) -> PageResult:
    url = _validate_url(url)
    async with _semaphore:
        ctx = await _new_context()
        page: Page | None = None
        try:
            page = await ctx.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=settings.browser_timeout)
            # SSRF guard: re-validate the final URL after any redirects
            _check_final_url(page.url)

            title = await page.title()
            content = await page.evaluate("""() => {
                const selectors = ['article', 'main', '[role="main"]', '.content', '#content', 'body'];
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && el.innerText.trim().length > 100) return el.innerText.trim();
                }
                return document.body?.innerText?.trim() || '';
            }""")
            content = re.sub(r'\n{3,}', '\n\n', content)

            return PageResult(
                url=page.url,
                title=title,
                content=content[:30000],
                metadata={"content_length": len(content)},
            )
        except Exception as e:
            logger.error("extract_content(%s) failed: %s", url, e)
            raise
        finally:
            if page:
                await page.close()
            await ctx.close()


async def screenshot(url: str) -> PageResult:
    url = _validate_url(url)
    async with _semaphore:
        os.makedirs(settings.screenshots_dir, exist_ok=True)
        ctx = await _new_context()
        page: Page | None = None
        try:
            page = await ctx.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=settings.browser_timeout)
            await page.wait_for_load_state("networkidle", timeout=min(settings.browser_timeout, 10000))
            # SSRF guard: re-validate the final URL after any redirects
            _check_final_url(page.url)

            ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            safe_name = re.sub(r'[^\w\-]', '_', urlparse(url).hostname or "page")
            path = os.path.join(settings.screenshots_dir, f"{safe_name}_{ts}.png")
            await page.screenshot(path=path, full_page=False)

            title = await page.title()
            return PageResult(
                url=page.url,
                title=title,
                screenshot_path=path,
            )
        except Exception as e:
            logger.error("screenshot(%s) failed: %s", url, e)
            raise
        finally:
            if page:
                await page.close()
            await ctx.close()
