package ai

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/chromedp/chromedp"
)

// ─── Browser Agent ─────────────────────────────────────────────────────

type BrowserAgent struct {
	config    *Config
	allocator context.Context
	cancel    context.CancelFunc
}

type PageResult struct {
	URL         string `json:"url"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	Screenshot  string `json:"screenshot,omitempty"`
	Links       []Link `json:"links,omitempty"`
	StatusCode  int    `json:"statusCode"`
	Error       string `json:"error,omitempty"`
	LoadTime    int    `json:"loadTimeMs"`
}

type Link struct {
	URL   string `json:"url"`
	Text  string `json:"text"`
	IsExt bool   `json:"isExternal"`
}

type SearchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}

type BrowseResult struct {
	Query     string         `json:"query"`
	Summary   string         `json:"summary"`
	Sources   []PageResult   `json:"sources"`
	Results   []SearchResult `json:"searchResults,omitempty"`
	PagesView int            `json:"pagesViewed"`
}

// NewBrowserAgent creates a new browser agent with shared allocator
func NewBrowserAgent() *BrowserAgent {
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("window-size", "1920,1080"),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), opts...)

	return &BrowserAgent{
		config:    AppConfig,
		allocator: allocCtx,
		cancel:    allocCancel,
	}
}

// Close cleans up browser resources
func (b *BrowserAgent) Close() {
	b.cancel()
}

// Navigate opens a URL and extracts content
func (b *BrowserAgent) Navigate(targetURL string) (*PageResult, error) {
	// Validate URL
	if err := b.validateURL(targetURL); err != nil {
		return nil, err
	}

	ctx, cancel := chromedp.NewContext(b.allocator, chromedp.WithLogf(nil))
	defer cancel()

	// Set timeout
	timeout := time.Duration(b.config.BrowserTimeout) * time.Second
	ctx, cancel = context.WithTimeout(ctx, timeout)
	defer cancel()

	result := &PageResult{URL: targetURL}
	start := time.Now()

	var html, title string
	var screenshotBuf []byte
	err := chromedp.Run(ctx,
		chromedp.Navigate(targetURL),
		chromedp.WaitReady("body"),
		chromedp.Title(&title),
		chromedp.OuterHTML("html", &html),
	)
	if err != nil {
		result.Error = err.Error()
		return result, nil
	}

	result.Title = title
	result.Content = extractTextFromHTML(html)
	result.LoadTime = int(time.Since(start).Milliseconds())

	// Take screenshot
	if b.config.ScreenshotDir != "" {
		os.MkdirAll(b.config.ScreenshotDir, 0755)
		screenshotPath := filepath.Join(b.config.ScreenshotDir, fmt.Sprintf("%d.png", time.Now().UnixNano()))
		if err := os.MkdirAll(filepath.Dir(screenshotPath), 0755); err == nil {
			if err := chromedp.Run(ctx, chromedp.CaptureScreenshot(&screenshotBuf)); err == nil {
				if err := os.WriteFile(screenshotPath, screenshotBuf, 0644); err == nil {
					result.Screenshot = screenshotPath
					cleanupOldScreenshots(b.config.ScreenshotDir)
				}
			}
		}
	}

	// Extract links
	links, _ := b.extractLinks(ctx)
	result.Links = links

	return result, nil
}

// Search performs a search and returns results
func (b *BrowserAgent) Search(query string) ([]SearchResult, error) {
	ctx, cancel := chromedp.NewContext(b.allocator, chromedp.WithLogf(nil))
	defer cancel()

	timeout := time.Duration(b.config.BrowserTimeout) * time.Second
	ctx, cancel = context.WithTimeout(ctx, timeout)
	defer cancel()

	searchURL := fmt.Sprintf("https://www.google.com/search?q=%s&hl=ru", url.QueryEscape(query))

	var html string
	err := chromedp.Run(ctx,
		chromedp.Navigate(searchURL),
		chromedp.WaitReady("body"),
		chromedp.OuterHTML("html", &html),
	)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	// Parse Google search results (simple extraction)
	results := parseGoogleResults(html)
	return results, nil
}

// ExtractContent extracts text content from a URL
func (b *BrowserAgent) ExtractContent(targetURL string) (string, error) {
	page, err := b.Navigate(targetURL)
	if err != nil {
		return "", err
	}
	if page.Error != "" {
		return "", fmt.Errorf("%s", page.Error)
	}
	return page.Content, nil
}

// Screenshot captures a screenshot of a URL
func (b *BrowserAgent) Screenshot(targetURL string) ([]byte, error) {
	if err := b.validateURL(targetURL); err != nil {
		return nil, err
	}

	ctx, cancel := chromedp.NewContext(b.allocator, chromedp.WithLogf(nil))
	defer cancel()

	timeout := time.Duration(b.config.BrowserTimeout) * time.Second
	ctx, cancel = context.WithTimeout(ctx, timeout)
	defer cancel()

	var buf []byte
	err := chromedp.Run(ctx,
		chromedp.Navigate(targetURL),
		chromedp.WaitReady("body"),
		chromedp.CaptureScreenshot(&buf),
	)
	if err != nil {
		return nil, fmt.Errorf("screenshot failed: %w", err)
	}

	return buf, nil
}

// ─── Helpers ───────────────────────────────────────────────────────────

func (b *BrowserAgent) validateURL(targetURL string) error {
	if b.config.AllowedDomains != nil && len(b.config.AllowedDomains) > 0 {
		parsed, err := url.Parse(targetURL)
		if err != nil {
			return fmt.Errorf("invalid URL: %w", err)
		}
		allowed := false
		for _, domain := range b.config.AllowedDomains {
			if parsed.Hostname() == domain || strings.HasSuffix(parsed.Hostname(), "."+domain) {
				allowed = true
				break
			}
		}
		if !allowed {
			return fmt.Errorf("domain not allowed: %s", parsed.Hostname())
		}
	}
	return nil
}

func (b *BrowserAgent) extractLinks(ctx context.Context) ([]Link, error) {
	var links []Link
	var urls []string
	var texts []string

	err := chromedp.Run(ctx,
		chromedp.Evaluate(`Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({url: a.href, text: a.textContent.trim()}))`, &struct {
			URLs  []string `json:"urls"`
			Texts []string `json:"texts"`
		}{}),
	)
	// Fallback: simple link extraction
	if err != nil {
		chromedp.Run(ctx,
			chromedp.Evaluate(`Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => a.href)`, &urls),
		)
		chromedp.Run(ctx,
			chromedp.Evaluate(`Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => a.textContent.trim())`, &texts),
		)
	}

	for i := 0; i < len(urls) && i < len(texts); i++ {
		isExt := strings.HasPrefix(urls[i], "http")
		links = append(links, Link{
			URL:   urls[i],
			Text:  texts[i],
			IsExt: isExt,
		})
	}

	return links, nil
}

func extractTextFromHTML(html string) string {
	// Simple HTML to text conversion
	text := html

	// Remove script and style tags
	for {
		start := strings.Index(text, "<script")
		if start == -1 {
			break
		}
		end := strings.Index(text[start:], "</script>")
		if end == -1 {
			text = text[:start]
			break
		}
		text = text[:start] + text[start+end+9:]
	}

	for {
		start := strings.Index(text, "<style")
		if start == -1 {
			break
		}
		end := strings.Index(text[start:], "</style>")
		if end == -1 {
			text = text[:start]
			break
		}
		text = text[:start] + text[start+end+8:]
	}

	// Remove HTML tags
	result := strings.Builder{}
	inTag := false
	for _, ch := range text {
		if ch == '<' {
			inTag = true
			continue
		}
		if ch == '>' {
			inTag = false
			result.WriteRune(' ')
			continue
		}
		if !inTag {
			result.WriteRune(ch)
		}
	}

	// Clean up whitespace: collapse all whitespace runs to a single space
	// (strings.Fields handles tabs/newlines/multi-space in one pass — O(n),
	// previously this was an O(n²) ReplaceAll loop).
	return strings.Join(strings.Fields(result.String()), " ")
}

// cleanupOldScreenshots removes screenshots older than 24 hours to prevent
// unbounded disk growth on the server.
func cleanupOldScreenshots(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	cutoff := time.Now().Add(-24 * time.Hour)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			os.Remove(filepath.Join(dir, e.Name()))
		}
	}
}

func parseGoogleResults(html string) []SearchResult {
	var results []SearchResult
	// Simple extraction - find <h3> tags and adjacent <a> tags
	lines := strings.Split(html, "\n")
	for i := 0; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])
		if strings.Contains(line, "<h3") {
			// Find the title text
			start := strings.Index(line, ">")
			end := strings.Index(line, "</h3>")
			if start > 0 && end > start {
				title := line[start+1 : end]
				title = strings.ReplaceAll(title, "<em>", "")
				title = strings.ReplaceAll(title, "</em>", "")
				title = extractTextFromHTML(title)

				// Find URL in preceding <a> tag
				for j := i - 5; j < i && j >= 0; j++ {
					aLine := strings.TrimSpace(lines[j])
					if strings.Contains(aLine, "href=\"/url?q=") {
						urlStart := strings.Index(aLine, "/url?q=")
						urlEnd := strings.Index(aLine[urlStart:], "&")
						if urlEnd > 0 {
							resultURL := aLine[urlStart+7 : urlStart+urlEnd]
							results = append(results, SearchResult{
								Title: title,
								URL:   resultURL,
							})
							break
						}
					}
				}
				if len(results) >= 10 {
					break
				}
			}
		}
	}
	return results
}
