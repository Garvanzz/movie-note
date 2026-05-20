import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { suggestActors } from "@/services/actorService";
import { suggestMovies } from "@/services/movieService";

const DEFAULT_LIMIT = 6;
const DEBOUNCE_MS = 160;

export function useMovieSuggestions(query: string, enabled = true, limit = DEFAULT_LIMIT) {
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS).trim();

  return useQuery({
    queryKey: ["movieSuggestions", debouncedQuery, limit],
    queryFn: () => suggestMovies(debouncedQuery, limit),
    enabled: enabled && debouncedQuery.length > 0,
    staleTime: 30_000,
  });
}

export function useActorSuggestions(query: string, enabled = true, limit = DEFAULT_LIMIT) {
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS).trim();

  return useQuery({
    queryKey: ["actorSuggestions", debouncedQuery, limit],
    queryFn: () => suggestActors(debouncedQuery, limit),
    enabled: enabled && debouncedQuery.length > 0,
    staleTime: 30_000,
  });
}
