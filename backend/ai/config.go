package ai

import (
	"os"
	"strconv"
)

type Config struct {
	// AI Proxy
	ProxyURL   string
	ProxySecret string

	// Browser
	BrowserTimeout   int // seconds
	MaxPagesPerQuery int
	AllowedDomains   []string
	ScreenshotDir    string

	// Rate limiting
	MaxConcurrentBrowsers int
	RequestsPerMinute     int
}

var AppConfig *Config

func InitConfig() {
	AppConfig = &Config{
		ProxyURL:    getEnv("AI_PROXY_URL", "https://nexo-ai-proxy.h40664555.workers.dev"),
		ProxySecret: getEnv("AI_PROXY_SECRET", "anwenjawenjinaijowd78dhq239s7ds"),

		BrowserTimeout:   getEnvInt("BROWSER_TIMEOUT", 30),
		MaxPagesPerQuery: getEnvInt("MAX_PAGES_PER_QUERY", 5),
		AllowedDomains:   []string{},
		ScreenshotDir:    getEnv("SCREENSHOT_DIR", "../uploads/screenshots"),

		MaxConcurrentBrowsers: getEnvInt("MAX_CONCURRENT_BROWSERS", 3),
		RequestsPerMinute:     getEnvInt("REQUESTS_PER_MINUTE", 30),
	}

	if domains := getEnv("ALLOWED_DOMAINS", ""); domains != "" {
		for _, d := range splitCSV(domains) {
			AppConfig.AllowedDomains = append(AppConfig.AllowedDomains, d)
		}
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func splitCSV(s string) []string {
	var result []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			item := s[start:i]
			if len(item) > 0 {
				result = append(result, item)
			}
			start = i + 1
		}
	}
	return result
}
