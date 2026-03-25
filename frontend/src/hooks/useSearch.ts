import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useState, useEffect } from 'react';

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useSearch(query: string) {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () =>
      apiFetch<{
        projects: any[];
        folders: any[];
        documents: any[];
        users: any[];
      }>(`/api/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
  });
}
