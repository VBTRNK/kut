@AGENTS.md

# Claude-specific notes

- Permissions and hooks for Claude live in `.claude/settings.json` and
  `.claude/hooks/`; the Codex equivalents are under `.codex/`.
- Your memory index (`MEMORY.md`) is loaded at start-up. Treat it as background:
  verify any file, flag or path it names before recommending it.
- The production-safety invariants reach you through the `@AGENTS.md` import;
  they are generated there from `policy/PRODUCTION_INVARIANTS.md`.
