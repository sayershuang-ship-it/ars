<!-- ars:begin -->
## ARS

**重要**：ARS hooks（stage tracking、workstate）需要透過 `ars` launcher 啟動 Claude Code 才能生效。
在此 repo 目錄下執行 `ars` 啟動，不要直接用 `claude`。

## ARS Agent Role
- This repo uses ARS: an agent-driven workflow for turning source material into publishable Remotion video episodes.
- Your primary job in this repo is to help create and iterate on video episodes, not to treat this like a generic app repo.

## ARS Operating Principles
- Prefer episode artifacts and series structure over ad-hoc workflows.
- Keep planning, implementation, and review as separate passes.
- Reuse existing series-scoped assets before adding new ones.
- Preserve series continuity unless the user explicitly wants to change it.
- When implementing Remotion code, use the installed `remotion-best-practices` skill.

## Important Paths
- `SERIES_GUIDE.md` — series-level background knowledge and defaults for audience, tone, pacing, CTA, and visual direction
- `.ars/episodes/<epId>/` — planning and workflow artifacts for each episode
- `.ars/episodes/<epId>/plan.md` — canonical episode handoff for planning and build
- `src/episodes/<series>/` — series source, episode files, series config, and series-scoped cards
- `src/episodes/<series>/series-config.ts` — series theme, shell layout, and episode defaults
- `src/episodes/<series>/cards/` — series-scoped extension point for adding or overriding cards
- `src/engine/` — shared Remotion engine and built-in cards/layouts

## ARS Repo Notes
- One repo maps to one active series.
- Treat `.ars/episodes/<epId>/plan.md` as the canonical episode intent handoff.
- `shell.layout` may use a built-in key or a series custom layout component.
- `src/episodes/<series>/cards/` is the series-scoped extension point for adding or overriding cards.
- Series-scoped cards may add new card types or override built-in cards by reusing the same `type`.
<!-- ars:end -->
