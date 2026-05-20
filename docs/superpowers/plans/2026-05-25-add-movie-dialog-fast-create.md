# Add Movie Dialog Fast Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the add movie dialog a code-only fast-create flow that navigates to the new movie detail page after creation.

**Architecture:** Keep the existing dialog and suggestion flow, but remove optional title entry so the dialog only captures the minimum record identity. Reuse the existing `create_movie` response to navigate with the canonical movie code after success.

**Tech Stack:** React 19, TypeScript, React Router, TanStack React Query, Tauri command API

---

### Task 1: Simplify AddMovieDialog

**Files:**
- Modify: `src/components/movie/AddMovieDialog.tsx`
- Validate: `npm run build`

- [ ] Remove title state and title input from the dialog.
- [ ] Keep only the code input and existing suggestion list.
- [ ] On submit, call `createMovie(code.trim())` and use the returned movie code for navigation.
- [ ] Invalidate the movie list query, close the dialog, and navigate to `/movies/:code`.
- [ ] Run `npm run build` to verify the dialog compiles cleanly.
