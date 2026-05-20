# Movie Interaction Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the movie workflow coherent end-to-end by removing fake entry points, exposing already-supported filtering/sorting capabilities, and restructuring the movie detail page around a clearer "identify -> organize -> consume" flow.

**Architecture:** Keep the current Tauri + React structure, but tighten the movie UX around a small number of focused UI units. Start with P0 fixes that restore trust in the UI, then improve movie discovery on the list page, and finally split the movie detail page into clearer sections without changing the underlying data model.

**Tech Stack:** React 19, TypeScript, TanStack Query, Zustand, Tauri v2, Rust, SQLite

---

## Current State Findings

- The movie list page exposes a table-view toggle, but the target state is not implemented and currently renders a placeholder. This is a fake entry point.
- The movie detail page exposes editable `source_url` and `source_site` fields, but the frontend mutation and Rust command do not persist them.
- The backend already supports `rating_min`, `rating_max`, `sort_by`, and `sort_dir`, but the list UI does not expose those controls.
- The movie detail page mixes metadata, media assets, taxonomy, and file association into one long vertical form, which increases cognitive load.
- Movie file association is technically functional, but the current text-only path entry is too raw for normal use.

## File Map

### Existing files to modify

- `src/pages/MovieListPage.tsx`
  - Own the movie list toolbar, top-level list actions, view switching, and pagination shell.
- `src/components/movie/MovieFilterSidebar.tsx`
  - Own search, facet filters, reset, and additional list-side controls.
- `src/stores/movieFilterStore.ts`
  - Own shared list filter state including sorting and view mode.
- `src/hooks/useMovies.ts`
  - Own query wiring for movie list data and filter options.
- `src/services/movieService.ts`
  - Own frontend invoke wrappers for movie commands.
- `src/pages/MovieDetailPage.tsx`
  - Own the movie detail editing, relationships, media assets, and file association flow.
- `src-tauri/src/commands/movie_commands.rs`
  - Own backend movie query/update logic including sorting/filtering and metadata persistence.

### New files recommended

- `src/components/movie/MovieListToolbar.tsx`
  - Extract view mode, sort controls, count, and add/scraper actions from the list page.
- `src/components/movie/MovieSortControls.tsx`
  - Encapsulate `sort_by`, `sort_dir`, and optional table-view gating.
- `src/components/movie/MovieMetadataSection.tsx`
  - Render and edit core movie metadata: title, runtime, release date, series, source, rating, watch status.
- `src/components/movie/MovieAssetsSection.tsx`
  - Render cover, cover gallery, screenshots, and image actions.
- `src/components/movie/MovieOrganizationSection.tsx`
  - Render tags, actors, genres, files, notes, and comment areas.

These splits are not mandatory for Phase 1, but they are recommended before expanding the movie detail UI further.

---

## Phase 1: Restore Trust In Primary Movie Actions (P0)

### Task 1: Remove fake movie list entry points

**Files:**
- Modify: `src/pages/MovieListPage.tsx`
- Modify: `src/components/movie/MovieFilterSidebar.tsx`
- Optional create: `src/components/movie/MovieListToolbar.tsx`

**Intent:** The user should not be able to enter a visible state that says "coming soon" from a normal primary control.

- [ ] Replace the current table-view placeholder flow with one of these temporary states:
  - hide table mode completely, or
  - disable it with explicit visual treatment and tooltip text `表格视图未开放`
- [ ] Keep grid mode as the only active browse mode until a real table view is implemented.
- [ ] Add an inline comment only if needed to explain why the table control is intentionally disabled.
- [ ] Ensure the list toolbar still shows count, add, scraper, and fetch activity clearly.

**Acceptance criteria:**
- No primary movie list button leads to a placeholder state.
- A user can understand from the toolbar which actions are currently supported.

### Task 2: Persist source URL and source site correctly

**Files:**
- Modify: `src/pages/MovieDetailPage.tsx`
- Modify: `src/services/movieService.ts`
- Modify: `src-tauri/src/commands/movie_commands.rs`

**Intent:** If the movie detail page exposes editable source metadata, saving must actually persist it.

- [ ] Extend the frontend `updateMovie()` invoke payload to include `sourceUrl` and `sourceSite`.
- [ ] Extend the Rust `update_movie` command signature to accept `source_url` and `source_site`.
- [ ] Update the SQL statement so those fields are written with the same `COALESCE` behavior used for the rest of movie metadata.
- [ ] Keep the current edit form unchanged except for wiring it to real persistence.

**Validation command:**
```powershell
npm run build
```

**Manual smoke:**
- Open one movie.
- Enter `source site` and `source URL`.
- Save.
- Refresh the page.
- Confirm values remain.

**Acceptance criteria:**
- `来源站点` and `来源 URL` survive save and reload.
- No existing movie edit field regresses.

---

## Phase 2: Make Movie Discovery Complete On The List Page (P0/P1)

### Task 3: Expose sorting controls already supported by the backend

**Files:**
- Modify: `src/stores/movieFilterStore.ts`
- Modify: `src/pages/MovieListPage.tsx`
- Create: `src/components/movie/MovieSortControls.tsx`
- Verify: `src/hooks/useMovies.ts`
- Verify: `src-tauri/src/commands/movie_commands.rs`

**Intent:** A user should be able to answer "show me the newest / highest rated / latest released" without leaving the list page.

- [ ] Add store actions for `setSort(sortBy, sortDir)` or equivalent explicit setters.
- [ ] Add sort options for:
  - `created_at desc` 近期入库
  - `updated_at desc` 最近整理
  - `release_date desc` 最新发行
  - `rating desc` 评分最高
  - `code asc` 番号排序
- [ ] Render sort controls in the list toolbar, not inside the taxonomy sidebar.
- [ ] Ensure sort state resets pagination to page 1.

**Validation command:**
```powershell
npm run build
```

**Acceptance criteria:**
- Sorting changes movie ordering immediately.
- Sort state is reflected in the query key and does not require manual refresh.

### Task 4: Add rating range controls to movie filtering

**Files:**
- Modify: `src/components/movie/MovieFilterSidebar.tsx`
- Modify: `src/stores/movieFilterStore.ts`
- Verify: `src/hooks/useMovies.ts`
- Verify: `src/types/movie.ts`
- Verify: `src-tauri/src/commands/movie_commands.rs`

**Intent:** Backend support for rating filtering should be visible in the UI.

- [ ] Add compact rating-range controls to the sidebar.
- [ ] Use either a badge-based preset model or min/max select inputs.
- [ ] Recommended presets:
  - `4.5+`
  - `4.0+`
  - `3.0+`
  - `未评分`
- [ ] If `未评分` is implemented, decide whether it should be supported in backend or deferred. Do not expose it unless it works.
- [ ] Reset page to 1 when rating filters change.

**Acceptance criteria:**
- A user can narrow the list by rating without typing.
- Rating filters combine cleanly with watch status, tags, actors, genres, and file status.

### Task 5: Add visible active-filter summary and single-filter clear actions

**Files:**
- Modify: `src/pages/MovieListPage.tsx`
- Modify: `src/components/movie/MovieFilterSidebar.tsx`
- Modify: `src/stores/movieFilterStore.ts`

**Intent:** Users need to understand why the current movie list looks the way it does.

- [ ] Render an active-filter summary row above the list content.
- [ ] Show pills for search, watch status, has-files, series, rating, tags, actors, and genres.
- [ ] Each pill should support single removal.
- [ ] Keep `resetFilter()` for full reset.

**Acceptance criteria:**
- The current filter state is legible at a glance.
- A user can remove one active condition without reopening the entire sidebar logic mentally.

---

## Phase 3: Restructure Movie Detail Around Clear Mental Buckets (P1)

### Task 6: Split the movie detail page into three visible sections

**Files:**
- Modify: `src/pages/MovieDetailPage.tsx`
- Create: `src/components/movie/MovieMetadataSection.tsx`
- Create: `src/components/movie/MovieAssetsSection.tsx`
- Create: `src/components/movie/MovieOrganizationSection.tsx`

**Intent:** Reduce cognitive overload by grouping the movie detail page into stable conceptual areas.

**Target structure:**
- `核心信息`
  - code, title, title_jp, release_date, runtime, series, watch_status, rating, source fields
- `媒体资产`
  - cover, cover gallery, screenshots, preview actions
- `整理信息`
  - tags, actors, genres, files, comment, notes

- [ ] Extract rendering logic from the large page component into smaller sections.
- [ ] Keep query ownership in the page for now if that minimizes churn.
- [ ] Pass only the data and callbacks each section needs.
- [ ] Preserve all existing functionality while improving scanability.

**Validation command:**
```powershell
npm run build
```

**Acceptance criteria:**
- The page reads top-to-bottom as identify -> assets -> organization.
- No behavior is lost during the split.

### Task 7: Clarify edit-mode boundaries on movie detail

**Files:**
- Modify: `src/pages/MovieDetailPage.tsx`
- Modify: `src/components/movie/MovieMetadataSection.tsx`
- Modify: `src/components/movie/MovieOrganizationSection.tsx`

**Intent:** The user should understand what "编辑" changes and what remains directly actionable outside edit mode.

- [ ] Limit true edit-mode responsibility to core metadata fields.
- [ ] Keep relational add/remove actions (tags, actors, genres, screenshots, files) available, but visually separate them from metadata editing.
- [ ] Standardize destructive action styling and confirmation behavior.
- [ ] Make the save button represent only metadata changes, not every possible action on the page.

**Acceptance criteria:**
- `编辑 / 保存 / 取消` has a clear meaning.
- Users do not confuse taxonomy/media actions with the metadata form lifecycle.

---

## Phase 4: Improve Organization Operations That Are Technically Working But UX-Weak (P1)

### Task 8: Improve movie file association input flow

**Files:**
- Modify: `src/pages/MovieDetailPage.tsx`
- Optional create: `src/components/movie/MovieFileSection.tsx`
- Verify: `src/services/fileService.ts`

**Intent:** Associating a file path should not require raw manual typing as the default path.

- [ ] Keep the current text input as a fallback.
- [ ] Add one higher-level input path, such as:
  - paste full path action,
  - multi-line paste parser,
  - or file picker if the intended storage model allows it.
- [ ] Show friendlier display text for associated files, prioritizing filename over raw path where available.
- [ ] Add copy-path action and, if feasible in Tauri, open-parent-folder action.

**Acceptance criteria:**
- File association is usable without technical confidence.
- Existing raw path support remains available for power users.

### Task 9: Normalize empty states and success/error feedback across movie operations

**Files:**
- Modify: `src/pages/MovieListPage.tsx`
- Modify: `src/pages/MovieDetailPage.tsx`
- Modify: `src/components/movie/MovieFilterSidebar.tsx`
- Verify toast usage in related files

**Intent:** The movie flow should feel consistent rather than assembled from unrelated local interactions.

- [ ] Normalize empty-state copy for:
  - no movies in list
  - no screenshots
  - no files
  - no tags / actors / genres
- [ ] Ensure every async movie operation has one success/failure feedback path.
- [ ] Ensure pending states disable the exact control being acted on when appropriate.

**Acceptance criteria:**
- Users always know whether an action succeeded, failed, or is still running.
- Empty sections communicate the next best action.

---

## Phase 5: Optional Enhancements After Core Trust And Flow Are Fixed (P2)

### Task 10: Decide whether to implement or permanently defer table view

**Files:**
- Modify: `src/pages/MovieListPage.tsx`
- Create: `src/components/movie/MovieTable.tsx`
- Optional modify: `src/components/movie/MovieListToolbar.tsx`

**Intent:** Only ship table view if it serves a real browse use case better than grid.

**Recommended columns:**
- code
- title
- release date
- rating
- watch status
- has files
- updated at

- [ ] Decide whether table view is still a product requirement.
- [ ] If yes, implement a minimal but real version.
- [ ] If no, remove the view mode state entirely.

**Acceptance criteria:**
- The app contains no dead-end view toggles.

### Task 11: Make scraper import feel like the first-class movie intake path

**Files:**
- Modify: `src/components/scraper/ScraperDialog.tsx`
- Modify: `src/pages/MovieListPage.tsx`
- Optional modify: `src/pages/MovieDetailPage.tsx`

**Intent:** Scraper import should feel like a standard intake flow, not an auxiliary tool.

- [ ] After successful import, navigate directly to the imported movie detail page or provide an explicit CTA.
- [ ] Show what was imported: metadata, cover, screenshots, actors.
- [ ] Consider exposing scraper as a first-class empty-state action on the list page.

**Acceptance criteria:**
- A first-time user can discover scraper as a normal intake workflow.

---

## Validation Checklist

Run after each completed phase:

```powershell
npm run build
```

For desktop smoke validation:

```powershell
$cmd = '"C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64 && cd /d D:\self\movie-note && npm run tauri dev'
cmd /c $cmd
```

Manual movie-flow smoke test:
- Open movie list and confirm no fake table entry point remains.
- Search by code and by title.
- Apply watch status, has-files, actor, tag, genre, and rating filters together.
- Change sorting and confirm list order changes.
- Open one movie and save title, source site, and source URL.
- Add and remove one tag, actor, and genre.
- Add one screenshot and preview it.
- Add one file association and remove it.
- Confirm all operations show feedback and survive a page reload.

## Recommended Execution Order

1. Phase 1: remove fake entry points and restore real metadata persistence.
2. Phase 2: make list discovery complete with sorting and rating filters.
3. Phase 3: split and clarify the movie detail page.
4. Phase 4: improve file association and consistency polish.
5. Phase 5: only then decide whether table view and scraper upgrades are worth the extra surface area.
