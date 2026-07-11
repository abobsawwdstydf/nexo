# AGENTS.md - Global Agent Instructions

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
