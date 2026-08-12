package ai

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

// ─── Task Manager ──────────────────────────────────────────────────────

type TaskStatus string

const (
	TaskPending   TaskStatus = "pending"
	TaskRunning   TaskStatus = "running"
	TaskCompleted TaskStatus = "completed"
	TaskFailed    TaskStatus = "failed"
)

type Task struct {
	ID          string     `json:"id"`
	UserID      string     `json:"userId"`
	ChatID      string     `json:"chatId"`
	Query       string     `json:"query"`
	Context     string     `json:"context"`
	Status      TaskStatus `json:"status"`
	Result      string     `json:"result"`
	Sources     []string   `json:"sources"`
	PagesViewed int        `json:"pagesViewed"`
	Error       string     `json:"error,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type TaskManager struct {
	tasks map[string]*Task
	mu    sync.RWMutex
}

var GlobalTaskManager = &TaskManager{
	tasks: make(map[string]*Task),
}

func (tm *TaskManager) CreateTask(id, userID, chatID, query, context string) *Task {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	// Opportunistic cleanup: drop stale completed/failed tasks when the map
	// grows (prevents unbounded memory growth on a long-lived server)
	if len(tm.tasks) > 500 {
		now := time.Now()
		for tid, t := range tm.tasks {
			if (t.Status == TaskCompleted || t.Status == TaskFailed) && now.Sub(t.UpdatedAt) > time.Hour {
				delete(tm.tasks, tid)
				if len(tm.tasks) <= 400 {
					break
				}
			}
		}
	}

	task := &Task{
		ID:        id,
		UserID:    userID,
		ChatID:    chatID,
		Query:     query,
		Context:   context,
		Status:    TaskPending,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	tm.tasks[id] = task
	return task
}

func (tm *TaskManager) GetTask(id string) *Task {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	t, ok := tm.tasks[id]
	if !ok {
		return nil
	}
	// Return a copy: the stored task is mutated by background goroutines
	// under mu.Lock, so handing out the raw pointer is a data race.
	copy := *t
	copy.Sources = append([]string(nil), t.Sources...)
	return &copy
}

func (tm *TaskManager) UpdateTask(id string, fn func(t *Task)) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	if t, ok := tm.tasks[id]; ok {
		fn(t)
		t.UpdatedAt = time.Now()
	}
}

func (tm *TaskManager) GetUserTasks(userID string, limit int) []*Task {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	var tasks []*Task
	for _, t := range tm.tasks {
		if t.UserID == userID {
			// Copy under RLock to avoid racing background writers.
			copy := *t
			copy.Sources = append([]string(nil), t.Sources...)
			tasks = append(tasks, &copy)
			if limit > 0 && len(tasks) >= limit {
				break
			}
		}
	}
	return tasks
}

// ─── Agent Orchestrator ────────────────────────────────────────────────

type Agent struct {
	LLM     *LLMClient
	Browser *BrowserAgent
	tasks   *TaskManager
}

func NewAgent() *Agent {
	return &Agent{
		LLM:     NewLLMClient(),
		Browser: NewBrowserAgent(),
		tasks:   GlobalTaskManager,
	}
}

// TranscribeFile recognizes speech in an audio file via the AI proxy.
func (a *Agent) TranscribeFile(filePath, contentType string) (string, string, error) {
	return a.LLM.TranscribeFile(filePath, contentType)
}

// Browse performs an AI-powered web search and analysis
func (a *Agent) Browse(taskID, query, chatContext string) {
	a.tasks.UpdateTask(taskID, func(t *Task) {
		t.Status = TaskRunning
	})

	task := a.tasks.GetTask(taskID)
	if task == nil {
		return
	}

	// Step 1: Search the web
	searchResults, err := a.Browser.Search(query)
	if err != nil {
		a.tasks.UpdateTask(taskID, func(t *Task) {
			t.Status = TaskFailed
			t.Error = fmt.Sprintf("Search failed: %v", err)
		})
		return
	}

	var sources []string
	var pageContents []string
	pagesViewed := 0

	// Step 2: Visit top results and extract content
	maxPages := AppConfig.MaxPagesPerQuery
	if maxPages > len(searchResults) {
		maxPages = len(searchResults)
	}

	for i := 0; i < maxPages; i++ {
		result := searchResults[i]
		if result.URL == "" {
			continue
		}

		page, err := a.Browser.Navigate(result.URL)
		if err != nil || page.Error != "" {
			continue
		}

		sources = append(sources, result.URL)
		// Truncate content for LLM
		content := page.Content
		if len(content) > 5000 {
			content = content[:5000]
		}
		pageContents = append(pageContents, fmt.Sprintf("=== %s (%s) ===\n%s", result.Title, result.URL, content))
		pagesViewed++

		a.tasks.UpdateTask(taskID, func(t *Task) {
			t.PagesViewed = pagesViewed
			t.Sources = sources
		})
	}

	// Step 3: Analyze combined content with LLM
	combinedContent := strings.Join(pageContents, "\n\n")
	if len(combinedContent) > 15000 {
		combinedContent = combinedContent[:15000]
	}

	systemPrompt := `Ты — AI-ассистент для анализа веб-страниц. 
Проанализируй собранные данные и дай исчерпывающий ответ на вопрос.
Используй информацию из разных источников. Указывай источники.
Отвечай на русском языке.`

	userPrompt := fmt.Sprintf("Контекст чата: %s\n\nВопрос пользователя: %s\n\nСобранные данные:\n%s",
		chatContext, query, combinedContent)

	summary, _, err := a.LLM.Simple(systemPrompt, userPrompt)
	if err != nil {
		a.tasks.UpdateTask(taskID, func(t *Task) {
			t.Status = TaskFailed
			t.Error = fmt.Sprintf("LLM analysis failed: %v", err)
		})
		return
	}

	// Step 4: Store result
	a.tasks.UpdateTask(taskID, func(t *Task) {
		t.Status = TaskCompleted
		t.Result = summary
		t.Sources = sources
		t.PagesViewed = pagesViewed
	})
}

// TranslateMessage translates a message
func (a *Agent) TranslateMessage(text, targetLang string) (string, string, error) {
	return a.LLM.Translate(text, targetLang)
}

// ModerateContent checks content safety
func (a *Agent) ModerateContent(text string) (string, float64, string, error) {
	return a.LLM.ModerateContent(text)
}

// AnswerQuestion answers a question about content
func (a *Agent) AnswerQuestion(content, question string) (string, error) {
	return a.LLM.AnswerQuestion(content, question)
}

// Close cleans up all resources
func (a *Agent) Close() {
	if a.Browser != nil {
		a.Browser.Close()
	}
}
