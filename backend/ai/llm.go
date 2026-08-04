package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// ─── Proxy Request/Response types ──────────────────────────────────────

type proxyMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type proxyRequest struct {
	Messages []proxyMessage `json:"messages"`
}

type proxyResponse struct {
	Text     string `json:"text"`
	Provider string `json:"provider"`
	Error    string `json:"error"`
}

const maxProxyResponseBytes int64 = 2 * 1024 * 1024

func readBoundedResponse(body io.Reader, limit int64) ([]byte, error) {
	limited := io.LimitReader(body, limit+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("response exceeds %d bytes", limit)
	}
	return data, nil
}

// ─── LLM Client (uses Nexo AI Proxy) ──────────────────────────────────

type LLMClient struct {
	config     *Config
	httpClient *http.Client
}

func NewLLMClient() *LLMClient {
	return &LLMClient{
		config: AppConfig,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// fallbackResp is a simple canned response used when the AI proxy is unreachable.
func fallbackResp(prompt string) (string, string, error) {
	return "AI-прокси временно недоступен. Пожалуйста, попробуйте позже.", "fallback", nil
}

// chat sends messages to the proxy /chat/auto endpoint.
// When the proxy is unreachable, returns a graceful fallback message instead of hard-failing.
func (c *LLMClient) chat(messages []proxyMessage) (string, string, error) {
	if c.config.ProxyURL == "" {
		return fallbackResp("")
	}

	proxyURL := c.config.ProxyURL
	if !strings.HasPrefix(proxyURL, "https://") {
		return "", "", fmt.Errorf("AI_PROXY_URL must use HTTPS")
	}

	req := proxyRequest{
		Messages: messages,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return "", "", fmt.Errorf("marshal request: %w", err)
	}

	url := strings.TrimRight(proxyURL, "/") + "/chat/auto"
	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return "", "", fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Proxy-Secret", c.config.ProxySecret)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		// Graceful degradation: proxy is unreachable
		return fallbackResp("")
	}
	defer resp.Body.Close()

	respBody, err := readBoundedResponse(resp.Body, maxProxyResponseBytes)
	if err != nil {
		return "", "", fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		// Graceful degradation: proxy returned error status
		return fallbackResp("")
	}

	var proxyResp proxyResponse
	if err := json.Unmarshal(respBody, &proxyResp); err != nil {
		return "", "", fmt.Errorf("unmarshal response: %w", err)
	}

	if proxyResp.Error != "" {
		return proxyResp.Text + " (AI временно недоступен)", proxyResp.Provider, nil
	}

	return proxyResp.Text, proxyResp.Provider, nil
}

// Simple sends a single prompt and returns the response
func (c *LLMClient) Simple(systemPrompt, userPrompt string) (string, int, error) {
	messages := []proxyMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}
	text, _, err := c.chat(messages)
	return text, 0, err // token count not available from proxy
}

// ChatMessage is a single conversation turn for Chat().
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Chat sends a full conversation (system + history + last user turn)
// and returns the assistant reply plus the provider name.
func (c *LLMClient) Chat(messages []ChatMessage) (string, string, error) {
	proxyMsgs := make([]proxyMessage, 0, len(messages))
	for _, m := range messages {
		proxyMsgs = append(proxyMsgs, proxyMessage{Role: m.Role, Content: m.Content})
	}
	return c.chat(proxyMsgs)
}

// ─── Speech-to-text (via Nexo AI Proxy /transcribe) ──────────────────────

type transcribeResponse struct {
	Text     string `json:"text"`
	Provider string `json:"provider"`
	Error    string `json:"error"`
}

// TranscribeFile sends an audio file to the AI proxy /transcribe endpoint
// (raw body, Content-Type audio/*) and returns the recognized text.
func (c *LLMClient) TranscribeFile(filePath, contentType string) (string, string, error) {
	if c.config.ProxyURL == "" {
		return "", "", fmt.Errorf("AI_PROXY_URL not configured")
	}
	proxyURL := c.config.ProxyURL
	if !strings.HasPrefix(proxyURL, "https://") {
		return "", "", fmt.Errorf("AI_PROXY_URL must use HTTPS")
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", "", fmt.Errorf("read audio: %w", err)
	}

	if contentType == "" {
		contentType = "audio/webm"
	}
	if !strings.HasPrefix(contentType, "audio/") {
		contentType = "audio/webm"
	}

	url := strings.TrimRight(proxyURL, "/") + "/transcribe"
	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return "", "", fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", contentType)
	httpReq.Header.Set("X-Proxy-Secret", c.config.ProxySecret)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return "", "", fmt.Errorf("proxy request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := readBoundedResponse(resp.Body, maxProxyResponseBytes)
	if err != nil {
		return "", "", fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("proxy status %d: %s", resp.StatusCode, string(respBody))
	}

	var tr transcribeResponse
	if err := json.Unmarshal(respBody, &tr); err != nil {
		return "", "", fmt.Errorf("unmarshal response: %w", err)
	}
	if tr.Error != "" {
		return "", "", fmt.Errorf("proxy error: %s", tr.Error)
	}
	return tr.Text, tr.Provider, nil
}

// ─── High-level LLM functions ─────────────────────────────────────────

// Translate translates text to target language
func (c *LLMClient) Translate(text, targetLang string) (string, string, error) {
	langNames := map[string]string{
		"ru": "русский", "en": "английский", "es": "испанский",
		"fr": "французский", "de": "немецкий", "zh": "китайский",
		"ja": "японский", "ko": "корейский", "ar": "арабский",
		"pt": "португальский", "it": "итальянский", "tr": "турецкий",
		"pl": "польский", "nl": "нидерландский", "sv": "шведский",
		"uk": "украинский", "kk": "казахский", "uz": "узбекский",
		"hi": "хинди", "th": "тайский", "vi": "вьетнамский",
		"id": "индонезийский", "cs": "чешский", "el": "греческий",
	}

	targetName := langNames[targetLang]
	if targetName == "" {
		targetName = targetLang
	}

	system := fmt.Sprintf("Ты — переводчик. Переведи текст на %s. Отвечай ТОЛЬКО переведённым текстом, без пояснений.", targetName)
	response, _, err := c.Simple(system, text)
	if err != nil {
		return "", "", err
	}

	// Detect source language (simple heuristic)
	sourceLang := "auto"
	if len(text) > 0 {
		first := text[0]
		if first >= 0xC0 { // Cyrillic
			sourceLang = "ru"
		} else if first >= 'A' && first <= 'Z' || first >= 'a' && first <= 'z' {
			sourceLang = "en"
		}
	}

	return response, sourceLang, nil
}

// ModerateContent checks content for spam/toxicity
func (c *LLMClient) ModerateContent(text string) (verdict string, score float64, reason string, err error) {
	system := `Ты — модератор контента. Проанализируй текст и определи:
1. Вердикт: safe, spam, toxic, или nsfw
2. Оценка от 0.0 до 1.0 (насколько текст проблемный)
3. Краткое объяснение почему

Отвечай в формате JSON:
{"verdict": "safe", "score": 0.1, "reason": "текст безопасен"}`

	response, _, err := c.Simple(system, text)
	if err != nil {
		return "safe", 0, "", err
	}

	// Parse JSON response
	response = strings.TrimSpace(response)
	start := strings.Index(response, "{")
	end := strings.LastIndex(response, "}")
	if start >= 0 && end > start {
		response = response[start : end+1]
	}

	var result struct {
		Verdict string  `json:"verdict"`
		Score   float64 `json:"score"`
		Reason  string  `json:"reason"`
	}
	if err := json.Unmarshal([]byte(response), &result); err != nil {
		return "safe", 0, response, nil
	}

	return result.Verdict, result.Score, result.Reason, nil
}

// AnswerQuestion answers a question about page content
func (c *LLMClient) AnswerQuestion(content, question string) (string, error) {
	if len(content) > 15000 {
		content = content[:15000]
	}

	system := `Ты — AI-ассистент. Отвечай на вопрос на основе предоставленного контента.
Если контент не содержит ответа, скажи "Не могу найти информацию по данному вопросу."
Отвечай на русском языке.`

	prompt := fmt.Sprintf("Контент:\n%s\n\nВопрос: %s", content, question)
	response, _, err := c.Simple(system, prompt)
	return response, err
}
