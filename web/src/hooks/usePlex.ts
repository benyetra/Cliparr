import { useState, useCallback } from 'react';
import { library } from '../lib/api';

export function useLibrarySections() {
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await library.sections();
      setSections(data.sections);
    } finally {
      setLoading(false);
    }
  }, []);

  return { sections, loading, load };
}

export function useLibraryItems() {
  const [items, setItems] = useState<any[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (sectionKey: string, start = 0, size = 50) => {
    setLoading(true);
    try {
      const data = await library.items(sectionKey, start, size);
      setItems(data.items);
      setTotalSize(data.totalSize);
    } finally {
      setLoading(false);
    }
  }, []);

  return { items, totalSize, loading, load };
}

export function useShowSeasons() {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (ratingKey: string) => {
    setLoading(true);
    try {
      const data = await library.showSeasons(ratingKey);
      setSeasons(data.seasons);
    } finally {
      setLoading(false);
    }
  }, []);

  return { seasons, loading, load };
}

export function useSeasonEpisodes() {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (ratingKey: string) => {
    setLoading(true);
    try {
      const data = await library.seasonEpisodes(ratingKey);
      setEpisodes(data.episodes);
    } finally {
      setLoading(false);
    }
  }, []);

  return { episodes, loading, load };
}

export function useMediaSearch() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await library.search(query);
      setResults(data.results);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, search };
}
