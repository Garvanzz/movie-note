# Code Normalization And Progressive Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize movie codes on write, migrate existing codes, and introduce shared progressive search with ranked suggestions for movies and actors across all search entry points.

**Architecture:** Add a backend-owned code normalization and suggestion layer, then thread that through movie writes, movie search, actor search, and lightweight suggestion commands. Frontend search inputs become thin clients that debounce input, display dropdown suggestions, and invoke shared backend behavior instead of implementing their own ranking rules.

**Tech Stack:** Rust, rusqlite, Tauri commands, React 19, TypeScript, TanStack Query, Zustand, Vitest, cargo test

---

## File Structure

### Backend core
- Modify: `src-tauri/src/code_parser.rs`
  - Expand from basic normalization into typed code classification, canonicalization, sort-key generation, and query normalization helpers.
- Modify: `src-tauri/src/models/movie.rs`
  - Add search/suggestion DTOs and extra persisted code metadata fields if needed in API models.
- Modify: `src-tauri/src/models/actor.rs`
  - Add actor suggestion DTO if not shared elsewhere.
- Modify: `src-tauri/src/db/migrations.rs`
  - Register a new migration.
- Create: `src-tauri/src/db/migrations/002_code_search_upgrade.sql`
  - Add new columns/indexes for code kind / sort key / actor alias search support.
- Modify: `src-tauri/src/commands/movie_commands.rs`
  - Normalize on create/update/import paths, upgrade ranked movie search, and add suggestion command.
- Modify: `src-tauri/src/commands/actor_commands.rs`
  - Add alias-aware ranked actor search and suggestion command.
- Modify: `src-tauri/src/commands/mod.rs`
  - Export any new command modules if needed.
- Modify: `src-tauri/src/lib.rs`
  - Register new suggestion commands.
- Modify: `src-tauri/src/commands/scraper_commands.rs`
  - Normalize outbound search query before hitting providers when appropriate.

### Frontend shared search
- Create: `src/types/search.ts`
  - Shared suggestion result types.
- Create: `src/services/searchService.ts`
  - Invoke wrappers for movie and actor suggestion commands.
- Create: `src/hooks/useSearchSuggestions.ts`
  - Shared debounced query hook for suggestions.
- Create: `src/components/search/SearchSuggestionList.tsx`
  - Shared dropdown UI with keyboard navigation.

### Frontend entry points
- Modify: `src/components/layout/GlobalSearchDialog.tsx`
  - Replace ad hoc movie/actor matching with shared suggestions while preserving tag/genre/series sections.
- Modify: `src/pages/MovieListPage.tsx`
  - Add live movie suggestion dropdown to main search input.
- Modify: `src/components/movie/AddMovieDialog.tsx`
  - Normalize/preview code input and surface duplicate / canonical write behavior.
- Modify: `src/components/scraper/ScraperDialog.tsx`
  - Normalize code-like input and add early suggestions where useful.
- Modify: `src/services/movieService.ts`
  - Add optional code-preview / suggestion support if needed.
- Modify: `src/services/actorService.ts`
  - Add actor suggestion wrapper if not moved to search service.

### Tests
- Modify: `src-tauri/src/code_parser.rs`
  - Expand unit tests inline.
- Create: `src/lib/searchRanking.test.ts`
  - Frontend-only ranking/selection helper tests if any pure helpers remain client-side.
- Create: `src/hooks/useSearchSuggestions.test.ts`
  - Suggestion hook behavior tests if pure enough.
- Modify: `src/stores/stores.test.ts`
  - Add any search-store related behavior if state is introduced.

## Task 1: Upgrade backend code normalization primitives

**Files:**
- Modify: `src-tauri/src/code_parser.rs`
- Test: `src-tauri/src/code_parser.rs`

- [ ] **Step 1: Write failing normalization and classification tests**

```rust
#[test]
fn canonicalizes_standard_codes() {
    let parsed = parse_code(" ipx123 ").expect("recognized code");
    assert_eq!(parsed.canonical, "IPX-123");
    assert_eq!(parsed.code_norm, "IPX123");
    assert_eq!(parsed.kind, CodeKind::Standard);
    assert_eq!(parsed.prefix.as_deref(), Some("IPX"));
    assert_eq!(parsed.number.as_deref(), Some("123"));
}

#[test]
fn canonicalizes_fc2_codes() {
    let parsed = parse_code("fc2ppv1234567").expect("recognized code");
    assert_eq!(parsed.canonical, "FC2-PPV-1234567");
    assert_eq!(parsed.code_norm, "FC2PPV1234567");
    assert_eq!(parsed.kind, CodeKind::Fc2);
}

#[test]
fn canonicalizes_site_numeric_codes() {
    let parsed = parse_code("heyzo 3850").expect("recognized code");
    assert_eq!(parsed.canonical, "HEYZO-3850");
    assert_eq!(parsed.kind, CodeKind::SiteNumeric);
    assert_eq!(parsed.prefix.as_deref(), Some("HEYZO"));
}

#[test]
fn canonicalizes_date_sequence_codes() {
    let parsed = parse_code("051926_001").expect("recognized code");
    assert_eq!(parsed.canonical, "051926-001");
    assert_eq!(parsed.kind, CodeKind::DateSequence);
}

#[test]
fn leaves_unknown_codes_cleaned_but_not_overwritten() {
    let parsed = parse_code("custom code x").expect("fallback code");
    assert_eq!(parsed.canonical, "CUSTOM-CODE-X");
    assert_eq!(parsed.kind, CodeKind::Unknown);
}

#[test]
fn builds_search_forms_for_partial_queries() {
    let query = normalize_search_query("ipx 123");
    assert_eq!(query.canonical_guess.as_deref(), Some("IPX-123"));
    assert_eq!(query.code_norm_guess.as_deref(), Some("IPX123"));
    assert_eq!(query.prefix_only.as_deref(), Some("IPX"));
}
```

- [ ] **Step 2: Run the parser tests and verify they fail**

Run: `cargo test code_parser --manifest-path src-tauri/Cargo.toml`
Expected: FAIL because `parse_code`, `CodeKind`, or `normalize_search_query` are not defined or do not satisfy the new assertions.

- [ ] **Step 3: Implement typed parsing and normalization helpers**

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CodeKind {
    Standard,
    Fc2,
    Amateur,
    DateSequence,
    SiteNumeric,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedCode {
    pub canonical: String,
    pub code_norm: String,
    pub kind: CodeKind,
    pub prefix: Option<String>,
    pub number: Option<String>,
    pub suffix: Option<String>,
    pub sort_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchQueryForms {
    pub raw: String,
    pub cleaned: String,
    pub canonical_guess: Option<String>,
    pub code_norm_guess: Option<String>,
    pub prefix_only: Option<String>,
}

pub fn parse_code(input: &str) -> Option<ParsedCode> {
    // classify in this order: FC2, site numeric, suffix standard, standard, amateur, date-sequence, fallback unknown
}

pub fn normalize_for_storage(input: &str) -> ParsedCode {
    parse_code(input).unwrap_or_else(|| fallback_unknown(input))
}

pub fn normalize_search_query(input: &str) -> SearchQueryForms {
    // produce cleaned, canonical guess, code_norm guess, prefix-only variants
}
```

- [ ] **Step 4: Run the parser tests and verify they pass**

Run: `cargo test code_parser --manifest-path src-tauri/Cargo.toml`
Expected: PASS for the new code normalization tests and existing parser tests.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/code_parser.rs
git commit -m "feat: normalize movie codes"
```

## Task 2: Add persisted search metadata and migration

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`
- Create: `src-tauri/src/db/migrations/002_code_search_upgrade.sql`
- Modify: `src-tauri/src/db/mod.rs`
- Test: `src-tauri/src/db/mod.rs`

- [ ] **Step 1: Write failing migration tests for new movie columns and indexes**

```rust
#[test]
fn migration_adds_code_search_columns() {
    let db = Database::new(temp_data_root()).expect("db");
    let conn = db.conn.lock().unwrap();

    let columns = table_columns(&conn, "movies");
    assert!(columns.contains(&"code_kind".to_string()));
    assert!(columns.contains(&"code_sort_key".to_string()));

    let indexes = table_indexes(&conn, "movies");
    assert!(indexes.iter().any(|name| name == "idx_movies_code_kind"));
}
```

- [ ] **Step 2: Run migration tests and verify they fail**

Run: `cargo test migration_adds_code_search_columns --manifest-path src-tauri/Cargo.toml`
Expected: FAIL because the new columns or indexes do not exist.

- [ ] **Step 3: Add migration and register it**

```sql
ALTER TABLE movies ADD COLUMN code_kind TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE movies ADD COLUMN code_sort_key TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_movies_code_kind ON movies(code_kind);
CREATE INDEX IF NOT EXISTS idx_movies_code_sort_key ON movies(code_sort_key);
CREATE INDEX IF NOT EXISTS idx_actor_aliases_alias ON actor_aliases(alias);
```

```rust
pub const MIGRATIONS: &[(&str, &str)] = &[
    ("001_initial.sql", include_str!("migrations/001_initial.sql")),
    ("002_code_search_upgrade.sql", include_str!("migrations/002_code_search_upgrade.sql")),
];
```

- [ ] **Step 4: Run migration tests and verify they pass**

Run: `cargo test migration_adds_code_search_columns --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/db/migrations.rs src-tauri/src/db/migrations/002_code_search_upgrade.sql src-tauri/src/db/mod.rs
git commit -m "feat: add code search migration"
```

## Task 3: Normalize writes and backfill migrated movie data

**Files:**
- Modify: `src-tauri/src/commands/movie_commands.rs`
- Modify: `src-tauri/src/db/mod.rs`
- Test: `src-tauri/src/commands/movie_commands.rs`
- Test: `src-tauri/src/db/workspace.rs`

- [ ] **Step 1: Write failing tests for create/update normalization and migration backfill**

```rust
#[test]
fn create_movie_stores_canonical_code() {
    let db = test_db();
    let movie = create_movie(db_state(&db), "ipx123".into(), None, None, None, None).expect("movie");
    assert_eq!(movie.code, "IPX-123");
    assert_eq!(movie.code_norm, "IPX123");
}

#[test]
fn migration_rewrites_existing_codes_to_canonical_form() {
    let db = test_db();
    insert_raw_movie(&db, "ipx123", "ipx123");

    backfill_movie_codes(&db).expect("backfill");

    let record = fetch_movie_code_fields(&db, "IPX-123");
    assert_eq!(record.code, "IPX-123");
    assert_eq!(record.code_norm, "IPX123");
    assert_eq!(record.code_kind, "standard");
}
```

- [ ] **Step 2: Run the focused movie command tests and verify they fail**

Run: `cargo test create_movie_stores_canonical_code --manifest-path src-tauri/Cargo.toml`
Expected: FAIL because `create_movie` currently preserves user formatting.

- [ ] **Step 3: Implement canonical write paths and backfill helper**

```rust
let parsed = normalize_for_storage(&code);
let canonical_code = parsed.canonical.clone();
let canonical_norm = parsed.code_norm.clone();
let code_kind = parsed.kind.as_str().to_string();
let code_sort_key = parsed.sort_key.clone();

conn.execute(
    "INSERT INTO movies (code, code_norm, code_kind, code_sort_key, series, title, title_jp, runtime, release_date) \
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    params![canonical_code, canonical_norm, code_kind, code_sort_key, series, title, title_jp, runtime, release_date],
)?;
```

```rust
pub fn backfill_movie_codes(conn: &Connection) -> Result<(), String> {
    // read existing rows, normalize code, detect collisions, update referencing tables in a transaction
}
```

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `cargo test create_movie_stores_canonical_code --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/movie_commands.rs src-tauri/src/db/mod.rs
git commit -m "feat: canonicalize stored movie codes"
```

## Task 4: Implement ranked movie search and suggestion command

**Files:**
- Modify: `src-tauri/src/models/movie.rs`
- Modify: `src-tauri/src/commands/movie_commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/commands/movie_commands.rs`

- [ ] **Step 1: Write failing tests for movie suggestion ranking**

```rust
#[test]
fn movie_suggestions_rank_exact_before_prefix_matches() {
    let db = seeded_movie_db(&[
        ("IPX-123", "IPX123", "standard", "IPX|000123|"),
        ("IPX-1234", "IPX1234", "standard", "IPX|001234|"),
        ("IPX-5123", "IPX5123", "standard", "IPX|005123|"),
    ]);

    let items = suggest_movies(db_state(&db), "ipx 123".into(), 5).expect("suggestions");
    assert_eq!(items[0].code, "IPX-123");
}
```

- [ ] **Step 2: Run the suggestion ranking test and verify it fails**

Run: `cargo test movie_suggestions_rank_exact_before_prefix_matches --manifest-path src-tauri/Cargo.toml`
Expected: FAIL because `suggest_movies` does not exist or ranking is not implemented.

- [ ] **Step 3: Add movie suggestion DTO and command**

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MovieSuggestion {
    pub code: String,
    pub title: Option<String>,
    pub release_date: Option<String>,
    pub match_kind: String,
}

#[tauri::command]
pub fn suggest_movies(db: State<Database>, query: String, limit: u32) -> Result<Vec<MovieSuggestion>, String> {
    // normalize query, score exact / no-separator exact / numeric-prefix / prefix / contains matches, return LIMIT ordered rows
}
```

- [ ] **Step 4: Run the suggestion ranking test and verify it passes**

Run: `cargo test movie_suggestions_rank_exact_before_prefix_matches --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/models/movie.rs src-tauri/src/commands/movie_commands.rs src-tauri/src/lib.rs
git commit -m "feat: add ranked movie suggestions"
```

## Task 5: Implement actor alias-aware ranked search and suggestions

**Files:**
- Modify: `src-tauri/src/models/actor.rs`
- Modify: `src-tauri/src/commands/actor_commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/commands/actor_commands.rs`

- [ ] **Step 1: Write failing tests for actor alias matching**

```rust
#[test]
fn actor_search_matches_aliases_but_prefers_primary_name() {
    let db = seeded_actor_db();
    insert_actor(&db, 1, "三上悠亚", Some("三上悠亜"));
    insert_actor_alias(&db, 1, "Yua Mikami");

    let result = get_actors(db_state(&db), Some("三上".into()), None, 1, 10).expect("actors");
    assert_eq!(result.items[0].name, "三上悠亚");

    let alias_result = suggest_actors(db_state(&db), "yua".into(), 5).expect("suggestions");
    assert_eq!(alias_result[0].name, "三上悠亚");
    assert_eq!(alias_result[0].match_kind, "alias_contains");
}
```

- [ ] **Step 2: Run the actor alias tests and verify they fail**

Run: `cargo test actor_search_matches_aliases_but_prefers_primary_name --manifest-path src-tauri/Cargo.toml`
Expected: FAIL because aliases are not searched and `suggest_actors` does not exist.

- [ ] **Step 3: Implement alias-aware search and actor suggestions**

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActorSuggestion {
    pub id: i64,
    pub name: String,
    pub name_jp: Option<String>,
    pub matched_name: String,
    pub match_kind: String,
}

// update SQL to LEFT JOIN actor_aliases and compute weighted ORDER BY for exact / prefix / contains hits
```

- [ ] **Step 4: Run the actor alias tests and verify they pass**

Run: `cargo test actor_search_matches_aliases_but_prefers_primary_name --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/models/actor.rs src-tauri/src/commands/actor_commands.rs src-tauri/src/lib.rs
git commit -m "feat: rank actor search by aliases"
```

## Task 6: Normalize scraper query input before external search

**Files:**
- Modify: `src-tauri/src/commands/scraper_commands.rs`
- Test: `src-tauri/src/commands/scraper_commands.rs`

- [ ] **Step 1: Write failing tests for scraper query normalization**

```rust
#[test]
fn scraper_search_normalizes_code_like_input() {
    assert_eq!(normalize_scraper_query("ipx123"), "IPX-123");
    assert_eq!(normalize_scraper_query("fc2ppv1234567"), "FC2-PPV-1234567");
}
```

- [ ] **Step 2: Run the scraper normalization tests and verify they fail**

Run: `cargo test scraper_search_normalizes_code_like_input --manifest-path src-tauri/Cargo.toml`
Expected: FAIL because helper is missing.

- [ ] **Step 3: Implement scraper query normalization helper**

```rust
fn normalize_scraper_query(query: &str) -> String {
    let forms = normalize_search_query(query);
    forms.canonical_guess.unwrap_or(forms.cleaned)
}
```

- [ ] **Step 4: Run the scraper normalization tests and verify they pass**

Run: `cargo test scraper_search_normalizes_code_like_input --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/scraper_commands.rs
git commit -m "feat: normalize scraper search input"
```

## Task 7: Add shared frontend suggestion types, service, and hook

**Files:**
- Create: `src/types/search.ts`
- Create: `src/services/searchService.ts`
- Create: `src/hooks/useSearchSuggestions.ts`
- Test: `src/hooks/useSearchSuggestions.test.ts`

- [ ] **Step 1: Write failing hook tests for debounced suggestions**

```ts
it("requests suggestions after debounce and resets when query clears", async () => {
  const { result, rerender } = renderHook(
    ({ query }) => useSearchSuggestions({ kind: "movie", query, limit: 5 }),
    { initialProps: { query: "ipx" } },
  );

  await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));

  rerender({ query: "" });
  expect(result.current.items).toEqual([]);
});
```

- [ ] **Step 2: Run the hook tests and verify they fail**

Run: `npm test -- useSearchSuggestions.test.ts`
Expected: FAIL because the hook and types do not exist.

- [ ] **Step 3: Implement shared suggestion service and hook**

```ts
export interface MovieSuggestion {
  code: string;
  title: string | null;
  release_date: string | null;
  match_kind: string;
}

export interface ActorSuggestion {
  id: number;
  name: string;
  name_jp: string | null;
  matched_name: string;
  match_kind: string;
}

export function suggestMovies(query: string, limit = 8): Promise<MovieSuggestion[]> {
  return invoke("suggest_movies", { query, limit });
}

export function useSearchSuggestions({ kind, query, limit = 8 }: UseSearchSuggestionsOptions) {
  const debouncedQuery = useDebounce(query, 160).trim();
  return useQuery({
    queryKey: ["searchSuggestions", kind, debouncedQuery, limit],
    queryFn: () => kind === "movie" ? suggestMovies(debouncedQuery, limit) : suggestActors(debouncedQuery, limit),
    enabled: debouncedQuery.length > 0,
    placeholderData: (previous) => previous,
  });
}
```

- [ ] **Step 4: Run the hook tests and verify they pass**

Run: `npm test -- useSearchSuggestions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/search.ts src/services/searchService.ts src/hooks/useSearchSuggestions.ts src/hooks/useSearchSuggestions.test.ts
git commit -m "feat: add shared search suggestions hook"
```

## Task 8: Add a reusable suggestion dropdown component

**Files:**
- Create: `src/components/search/SearchSuggestionList.tsx`
- Test: `src/lib/searchRanking.test.ts`

- [ ] **Step 1: Write failing tests for keyboard selection behavior**

```ts
it("moves highlight with arrow keys and selects highlighted item on enter", () => {
  const state = reduceSuggestionKeyboard(
    { index: 0, itemCount: 3 },
    { key: "ArrowDown" },
  );
  expect(state.index).toBe(1);
});
```

- [ ] **Step 2: Run the keyboard helper tests and verify they fail**

Run: `npm test -- searchRanking.test.ts`
Expected: FAIL because the helper/component contract is missing.

- [ ] **Step 3: Implement the dropdown component and small keyboard helper**

```tsx
export function SearchSuggestionList<T>({
  items,
  getKey,
  renderLabel,
  renderMeta,
  activeIndex,
  onHover,
  onSelect,
}: SearchSuggestionListProps<T>) {
  if (items.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      {items.map((item, index) => (
        <button
          key={getKey(item)}
          type="button"
          onMouseEnter={() => onHover(index)}
          onClick={() => onSelect(item)}
          className={cn(
            "flex w-full items-start justify-between gap-3 px-3 py-3 text-left",
            index === activeIndex && "bg-accent/40",
          )}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{renderLabel(item)}</div>
            {renderMeta ? <div className="mt-1 text-xs text-muted-foreground">{renderMeta(item)}</div> : null}
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the keyboard helper tests and verify they pass**

Run: `npm test -- searchRanking.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/search/SearchSuggestionList.tsx src/lib/searchRanking.test.ts
git commit -m "feat: add reusable suggestion dropdown"
```

## Task 9: Wire progressive movie suggestions into MovieListPage and AddMovieDialog

**Files:**
- Modify: `src/pages/MovieListPage.tsx`
- Modify: `src/components/movie/AddMovieDialog.tsx`
- Test: `src/stores/stores.test.ts`

- [ ] **Step 1: Add failing coverage for query-state reset if local helper state is introduced**

```ts
it("clears suggestion state when search query resets", () => {
  const state = reduceSuggestionUi({ open: true, activeIndex: 2 }, { type: "query-cleared" });
  expect(state).toEqual({ open: false, activeIndex: 0 });
});
```

- [ ] **Step 2: Run the focused frontend tests and verify they fail**

Run: `npm test -- stores.test.ts searchRanking.test.ts`
Expected: FAIL if the reducer/helper is not implemented.

- [ ] **Step 3: Add dropdown behavior to the list search and code entry dialog**

```tsx
const movieSuggestions = useSearchSuggestions({ kind: "movie", query: search, limit: 8 });

<Input
  id="movie-search"
  value={search}
  onChange={(event) => setSearch(event.target.value)}
  onKeyDown={handleMovieSearchKeys}
/>
<SearchSuggestionList
  items={movieSuggestions.data ?? []}
  activeIndex={activeIndex}
  onHover={setActiveIndex}
  onSelect={(item) => {
    setSearch(item.code);
    navigate(`/movies/${encodeURIComponent(item.code)}`);
  }}
  getKey={(item) => item.code}
  renderLabel={(item) => item.code}
  renderMeta={(item) => item.title ?? "未命名影片"}
/>
```

```tsx
const normalizedPreview = useMemo(() => normalizeCodePreview(code), [code]);
<label className="text-xs text-muted-foreground">将保存为 {normalizedPreview}</label>
```

- [ ] **Step 4: Run the focused frontend tests and verify they pass**

Run: `npm test -- stores.test.ts searchRanking.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/MovieListPage.tsx src/components/movie/AddMovieDialog.tsx src/stores/stores.test.ts
git commit -m "feat: add movie search suggestions"
```

## Task 10: Wire shared suggestions into GlobalSearchDialog and ScraperDialog

**Files:**
- Modify: `src/components/layout/GlobalSearchDialog.tsx`
- Modify: `src/components/scraper/ScraperDialog.tsx`
- Test: `src/hooks/useSearchSuggestions.test.ts`

- [ ] **Step 1: Extend failing tests for empty-state and input-reset behavior**

```ts
it("does not request suggestions for empty query", async () => {
  const { result } = renderHook(() => useSearchSuggestions({ kind: "movie", query: "", limit: 5 }));
  expect(result.current.items).toEqual([]);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- useSearchSuggestions.test.ts`
Expected: FAIL if empty-query handling is not implemented.

- [ ] **Step 3: Replace ad hoc matching with shared suggestions in global and scraper search**

```tsx
const movieSuggestions = useSearchSuggestions({ kind: "movie", query, limit: 5 });
const actorSuggestions = useSearchSuggestions({ kind: "actor", query, limit: 5 });
```

```tsx
const normalizedQuery = useMemo(() => previewNormalizedCode(query), [query]);
<p className="text-xs text-muted-foreground">将按 {normalizedQuery} 搜索在线源</p>
```

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `npm test -- useSearchSuggestions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/GlobalSearchDialog.tsx src/components/scraper/ScraperDialog.tsx src/hooks/useSearchSuggestions.test.ts
git commit -m "feat: reuse progressive suggestions across search"
```

## Task 11: Run verification suite and fix regressions

**Files:**
- Modify: any files touched above if failures expose local defects

- [ ] **Step 1: Run backend targeted tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml code_parser movie_suggestions_rank_exact_before_prefix_matches actor_search_matches_aliases_but_prefers_primary_name`
Expected: PASS.

- [ ] **Step 2: Run frontend targeted tests**

Run: `npm test -- useSearchSuggestions.test.ts searchRanking.test.ts stores.test.ts`
Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Run desktop smoke validation**

Run: `cmd /c "\"C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat\" -arch=x64 && cd /d D:\self\movie-note && npm run tauri dev"`
Expected: App launches, movie list search shows progressive suggestions, global search returns ranked movie/actor results, scraper dialog shows normalized query hint.

- [ ] **Step 5: Commit final integration fixes**

```bash
git add src-tauri src docs/superpowers/plans/2026-05-25-code-normalization-and-progressive-search.md
git commit -m "feat: unify normalized progressive search"
```

## Self-Review

### Spec coverage
- Code normalization rules: covered by Tasks 1, 3, and 6.
- Canonical storage without raw input retention: covered by Tasks 2 and 3.
- Progressive movie search and ranking: covered by Task 4 and Task 9.
- Actor multi-name gradual matching: covered by Task 5 and Task 10.
- Shared cross-entry search behavior: covered by Tasks 7 through 10.
- Migration and conflict handling: covered by Task 3.
- Verification: covered by Task 11.

### Placeholder scan
- No `TODO`, `TBD`, or deferred placeholders remain.
- Each task includes concrete files, code, commands, and expected outcomes.

### Type consistency
- Shared naming stays on `CodeKind`, `ParsedCode`, `SearchQueryForms`, `MovieSuggestion`, `ActorSuggestion`, `suggest_movies`, and `suggest_actors` across tasks.
- Frontend suggestion hook consistently uses `useSearchSuggestions` with `kind: "movie" | "actor"`.
