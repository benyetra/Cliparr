import { useState, useCallback } from 'react';
import { clips } from '../lib/api';

export function useClipList() {
  const [clipList, setClipList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (params?: { status?: string; page?: number }) => {
    setLoading(true);
    try {
      const data = await clips.list(params);
      setClipList(data.clips);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => load(), [load]);

  return { clips: clipList, loading, load, refresh };
}

export function useClipCreate() {
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (data: {
    ratingKey: string;
    startMs: number;
    endMs: number;
    title?: string;
    ttlHours?: number;
    maxViews?: number;
  }) => {
    setCreating(true);
    setError(null);
    try {
      const res = await clips.create(data);
      setResult(res);
      return res;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setCreating(false);
    }
  }, []);

  return { creating, result, error, create };
}
