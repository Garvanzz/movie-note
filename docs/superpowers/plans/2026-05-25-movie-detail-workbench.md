# Movie Detail Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the movie detail page into a single-page workbench where metadata, media assets, relationships, files, and notes are edited in place.

**Architecture:** Rebuild `MovieDetailPage` as the orchestration shell and reuse the existing `MovieMetadataSection`, `MovieAssetsSection`, and `MovieOrganizationSection` as the main editing blocks. Keep mutations local to the page, invalidate the relevant query slices, and preserve the current movie detail route.

**Tech Stack:** React 19, TypeScript, React Router, TanStack React Query, Tauri invoke services

---

### Task 1: Recompose MovieDetailPage

**Files:**
- Modify: `src/pages/MovieDetailPage.tsx`
- Validate: `npm run build`

- [ ] Replace the current summary-first layout with a workbench shell containing a top action header, metadata section, media assets section, and organization section.
- [ ] Add the missing detail-page queries and mutations for movie covers, screenshots, tags, genres, actors, files, and delete movie.
- [ ] Keep metadata editable in place and wire a save/reset flow for title, status, rating, notes, and source fields.
- [ ] Reuse the existing asset and organization sections so cover, screenshot, relation, and file operations are available directly on the page.
- [ ] Run `npm run build` and fix any compilation issues introduced by the new workbench shell.

### Task 2: Tighten section copy if needed

**Files:**
- Modify: `src/components/movie/MovieMetadataSection.tsx` (only if the always-edit usage needs copy/layout adjustment)
- Validate: `npm run build`

- [ ] Adjust section text or small layout details only if the new page composition makes the current wording misleading.
- [ ] Re-run `npm run build` to confirm the section still compiles cleanly.
