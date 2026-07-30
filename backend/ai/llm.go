package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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

	respBody, err := io.ReadAll(resp.Body)
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

// ─── High-level LLM functions ─────────────────────────────────────────

// AnalyzePage analyzes page content for a user query
func (c *LLMClient) AnalyzePage(content, query string) (string, error) {
	system := `Ты — AI-ассистент для анализа веб-страниц. 
Проанализируй содержимое страницы и ответь на вопрос пользователя.
Отвечай на русском языке. Будь конкретным и точным.
Если информации недостаточно, скажи об этом.`

	if len(content) > 15000 {
		content = content[:15000] + "\n\n[...контент обрезан...]"
	}

	prompt := fmt.Sprintf("Содержимое страницы:\n%s\n\nВопрос: %s", content, query)
	response, _, err := c.Simple(system, prompt)
	return response, err
}

// Summarize summarizes content
func (c *LLMClient) Summarize(content string, maxTokens int) (string, error) {
	if len(content) > 20000 {
		content = content[:20000] + "\n\n[...контент обрезан...]"
	}

	system := "Ты — AI для суммаризации. Сделай краткое содержание (3-5 абзацев). Отвечай на русском."
	response, _, err := c.Simple(system, content)
	return response, err
}

// SuggestReplies suggests chat replies based on context
func (c *LLMClient) SuggestReplies(context string) ([]string, error) {
	system := `Ты — AI-ассистент для мессенджера. 
Предложи 3 варианта ответа на сообщение. 
Отвечай на русском. Формат: просто текст ответа, каждый с новой строки.
Не нумеруй и не используй маркеры.`

	response, _, err := c.Simple(system, context)
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(response), "\n")
	var suggestions []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			suggestions = append(suggestions, line)
		}
	}
	if len(suggestions) == 0 {
		suggestions = append(suggestions, response)
	}
	return suggestions, nil
}

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

// GenerateTitle generates a title for a chat based on messages
func (c *LLMClient) GenerateTitle(messages string) (string, error) {
	system := "Придумай короткий заголовок (2-5 слов) для чата на основе последних сообщений. Отвечай только заголовком."
	response, _, err := c.Simple(system, messages)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(response), nil
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
