# AGENTS.md - Global Agent Instructions

## ⚠️ НЕПРИКОСНОВЕННОСТЬ ДАННЫХ ПОЛЬЗОВАТЕЛЕЙ (ABSOLUTE RULE)

**НИ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ НЕ ТРОГАТЬ:**
- Базу данных SQLite (`nexo.db`, `nexo.db-*`)
- Файлы пользователей (`uploads/`, `backend/uploads/`)
- Таблицы пользователей, сообщений, чатов, историй
- JWT-токены, сессии, ключи шифрования
- Пароли, email-адреса, любые персональные данные

**МОЖНО ИЗМЕНЯТЬ ТОЛЬКО:**
- Код (`.go`, `.ts`, `.tsx`, `.css`, конфиги)
- Публичные настройки (CORS, домены, API-эндпоинты)
- Документацию, README, AGENTS.md, PLANS.md

**Нарушение этого правила = необратимая потеря данных пользователей.**

---

## 🏢 О ПРОЕКТЕ

- **Компания:** Dark Heavens Corporate
- **Сайт:** https://www.darkheavens.ru
- **Проект:** Нексо (Nexo) — Защищённый мессенджер
- **Репозиторий:** GitHub Private
- **Статус:** Production (бета 14 дней)

### Деплой
- **Frontend (Cloudflare Pages):** Автоматический деплой из GitHub (триггер — только `frontend/**`)
- **Backend (сервер 192.168.0.64):** SSH `dh-s-1` (юзер `dh-s-1`, НЕ root) + авто-деплой из GitHub
- **AI Proxy:** https://nexo-ai-proxy.h40664555.workers.dev

#### Деплой бэкенда (важно)
- Бэкенд работает из `/opt/nexo/nexo` (systemd-сервис `nexo.service`, WorkingDirectory `/opt/nexo`, env из `/opt/nexo/.env`)
- Авто-деплой: `/opt/nexo/auto-deploy.sh` опрашивает GitHub каждые 60с, `/opt/nexo/deploy.sh` делает `git reset --hard origin/main`
- **НЕ пересобирает код**: deploy.sh просто копирует готовый кросс-компилированный бинарник `backend/nexo-linux` (он в .gitignore, в репо не лежит). Если его нет — бэкенд НЕ обновится
- **Как задеплоить бэкенд (автоматически):** `powershell -ExecutionPolicy Bypass -File backend/deploy-backend.ps1` (или `./backend/deploy-backend.ps1`) — сам: получает SHA/time из git, кросс-компилирует `nexo-linux`, scp на сервер, chmod +x, `.new`+`mv`, рестарт `nexo.service`, проверяет `/api/version`
- **Как задеплоить бэкенд вручную:**
  1. `cd backend; $env:GOOS="linux"; $env:GOARCH="amd64"; $env:CGO_ENABLED="0"` (SQLite — modernc pure-Go, CGO не нужен)
  2. `go build -ldflags "-X main.buildVersion=<sha> -X main.buildCommit=<sha> -X main.buildTime=<iso>" -o nexo-linux .`
  3. `scp backend/nexo-linux dh-s-1@192.168.0.64:/opt/nexo-repo/backend/nexo-linux`
  4. `ssh dh-s-1 "chmod +x /opt/nexo/nexo /opt/nexo-repo/backend/nexo-linux && cp /opt/nexo-repo/backend/nexo-linux /opt/nexo/nexo.new && mv -f /opt/nexo/nexo.new /opt/nexo/nexo && echo '0611 .com' | sudo -S systemctl restart nexo.service"`
  - ⚠️ `cp` напрямую в `/opt/nexo/nexo` падает с "Text file busy" — только через `.new` + `mv`
  - ⚠️ после scp ОБЯЗАТЕЛЬНО `chmod +x` на обоих файлах, иначе `systemctl` даст `status=203/EXEC`
- Версия бэкенда: `GET /api/version` (JSON для API, HTML-страница с идентификатором для браузера)

### Домены фронтенда
- https://msg.darkheavens.ru
- https://msg.hakerone.ru
- https://n.darkheavens.ru
- https://n.hakerone.ru
- https://nexo.darkheavens.ru
- https://nexo.hakerone.ru
- https://xn--e1akhgo.hakerone.ru (нексо.hakerone.ru)
- https://xn--e1akhgo.darkheavens.ru (нексо.darkheavens.ru)

### Бэкенд
- **Публичный API:** https://neexxoo.hakerone.ru

---

## Core Thinking Protocol

Before answering any question or solving any problem, follow this thinking sequence:

1. **Understand the Goal**: What exactly does the user want? What is the end state?
2. **Analyze Context**: What existing code, patterns, or constraints exist?
3. **Consider Alternatives**: What are 2-3 different approaches? What are trade-offs?
4. **Select Best Approach**: Choose the approach that balances simplicity, performance, and maintainability.
5. **Plan Implementation**: Break into small, testable steps.
6. **Execute**: Implement with attention to edge cases and error handling.
7. **Verify**: Check the solution works as intended.

## Design Principles

### Liquid Glass Design (Modern UI)
When creating or modifying UI code, follow these principles:

- **Translucency**: Use backdrop-filter: blur() and semi-transparent backgrounds (rgba/hsla with alpha < 1)
- **Depth**: Create layered visual hierarchy with shadows and blur
- **Minimalism**: Clean lines, generous spacing, subtle gradients
- **Motion**: Smooth transitions (0.2-0.4s ease), hover effects, micro-interactions
- **Color**: Use HSL color model for easy manipulation; prefer vibrant accents on neutral backgrounds
- **Typography**: Clear hierarchy, readable fonts, proper line-height (1.5-1.7)
- **Consistency**: Use CSS custom properties for theming; maintain spacing scale (4px, 8px, 16px, 24px, 32px, 48px)

### Code Quality Standards
- **Single Responsibility**: Each function/class does one thing well
- **DRY**: Don't Repeat Yourself - extract common patterns
- **KISS**: Keep It Simple, Stupid - prefer clarity over cleverness
- **YAGNI**: You Aren't Gonna Need It - don't add features until needed
- **Error Handling**: Always handle edge cases; never assume input validity
- **Type Safety**: Use TypeScript/typed languages; avoid `any` when possible
- **Immutability**: Prefer const/readonly; avoid mutation when possible
- **Composition**: Favor composition over inheritance

### Naming Conventions
- **Variables/Functions**: camelCase (JavaScript/TypeScript) or snake_case (Python)
- **Classes/Types**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Files**: kebab-case for web, PascalCase for React components
- **Be Descriptive**: `userInput` not `ui`, `calculateTotalPrice` not `calc`

## Agent Collaboration Rules

1. **Delegate Appropriately**: Use specialized subagents for their domain expertise
2. **Context Passing**: Always provide full context when invoking subagents
3. **Result Acceptance**: Trust subagent output unless there's a specific reason to question
4. **Escalation**: When uncertain, ask the user rather than guessing
5. **Documentation**: Update docs when code changes

## Response Format

- **Concise**: Get to the point quickly
- **Structured**: Use headers, lists, code blocks for clarity
- **Actionable**: Provide concrete next steps
- **Educational**: Explain why, not just what (when helpful)

## Model Enhancement Tips

To get better results from any model:

1. **Be Specific**: Include file paths, line numbers, error messages
2. **Provide Context**: Show relevant code snippets, not just the problem
3. **Set Constraints**: Specify language, framework, style preferences
4. **Iterate**: If the first answer isn't perfect, refine with feedback
5. **Ask for Alternatives**: Request multiple approaches to compare

## Transferable Patterns

These patterns work across all projects:

### Project Structure
```
project/
  src/           # Source code
  tests/         # Test files
  docs/          # Documentation
  config/        # Configuration files
  scripts/       # Build/deploy scripts
```

### Git Workflow
- Feature branches from main
- Descriptive commit messages
- PR reviews before merge
- Semantic versioning

### CI/CD
- Lint on commit
- Tests on PR
- Auto-deploy on main merge
- Rollback capability
