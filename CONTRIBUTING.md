# Contributing to HeapVortex

Thank you for your interest in improving HeapVortex! Please follow these guidelines.

## Branching

| Branch | Purpose |
|--------|---------|
| `main` | Stable, always deployable |
| `feat/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `chore/<name>` | Tooling, deps, config |

## Commit Style

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`  
**Scopes:** `frontend`, `backend`, `api`, `ui`, `config`, `docs`

**Examples:**
```
feat(frontend): add memory leak heatmap overlay
fix(backend): handle NaN in heap ratio calculation
docs: update README with Docker Compose setup
```

## Code Style

### Java (backend)
- 4-space indentation
- Java 21 features encouraged (records, text blocks, pattern matching)
- All public methods should have Javadoc

### JavaScript / JSX (frontend)
- 2-space indentation
- Prefer `const` over `let`; avoid `var`
- Functional components only (no class components)
- Keep components small — split if > 100 lines

### CSS
- Group related rules with a comment header matching the existing style
- Use CSS custom properties for repeated colours
- Mobile-first media queries

## Pull Request Checklist

- [ ] Code builds without errors (`mvn package` / `npm run build`)
- [ ] No `console.log` left in production code
- [ ] New API endpoints documented in README
- [ ] Commit messages follow Conventional Commits
- [ ] PR description explains *why*, not just *what*

## Security

- Never commit secrets, credentials, or `.env` files
- Never expose JMX endpoints on a public network
- Use HTTPS in production; update `CorsConfig` to restrict origins
