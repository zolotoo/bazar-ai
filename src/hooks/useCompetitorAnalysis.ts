import { useCallback, useEffect, useState } from 'react';
import { supabase, setUserContext } from '../utils/supabase';

export type CompetitorAnalysisStatus =
  | 'pending'
  | 'fetching_competitor'
  | 'transcribing_competitor'
  | 'extracting_hooks'
  | 'fetching_user'
  | 'transcribing_user'
  | 'analyzing_user'
  | 'generating_ideas'
  | 'ready'
  | 'error'
  | 'no_virals';

export interface CompetitorHook {
  id: string;
  analysis_id: string;
  shortcode: string;
  url: string | null;
  thumbnail_url: string | null;
  hook_text: string | null;
  transcript_text: string | null;
  caption: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  taken_at: string | null;
  viral_multiplier: number | null;
  niche: string | null;
  is_fallback: boolean;
  rank: number | null;
}

export interface UserToneProfile {
  voice?: { tempo?: string; energy?: string; formality?: string };
  recurring_topics?: string[];
  signature_phrases?: string[];
  hook_patterns?: string[];
  structure?: string;
  humor?: string;
  stop_words?: string[];
  summary?: string;
}

export interface GeneratedIdea {
  title: string;
  adapted_hook: string;
  structure_outline: string;
  why_it_works: string;
  based_on_competitor_shortcode?: string;
}

export interface CompetitorAnalysis {
  id: string;
  project_id: string;
  user_id: string;
  competitor_username: string;
  user_username: string | null;
  reel_count: number;
  status: CompetitorAnalysisStatus;
  status_message: string | null;
  error_message: string | null;
  competitor_avg_views: number | null;
  competitor_median_views: number | null;
  competitor_avg_bottom3_views: number | null;
  viral_threshold_multiplier: number | null;
  user_tone_profile: UserToneProfile | null;
  generated_ideas: { ideas: GeneratedIdea[] } | null;
  created_at: string;
  updated_at: string;
}

export function useCompetitorAnalysis(projectId?: string, userId?: string) {
  const [analyses, setAnalyses] = useState<CompetitorAnalysis[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId || !userId) {
      setAnalyses([]);
      return;
    }
    setLoading(true);
    await setUserContext(userId);
    const { data, error } = await supabase
      .from('competitor_analyses')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      console.error('[useCompetitorAnalysis] load error', error);
      return;
    }
    setAnalyses((data || []) as CompetitorAnalysis[]);
  }, [projectId, userId]);

  useEffect(() => { load(); }, [load]);

  const fetchOne = useCallback(async (id: string): Promise<CompetitorAnalysis | null> => {
    const { data } = await supabase.from('competitor_analyses').select('*').eq('id', id).maybeSingle();
    return (data as CompetitorAnalysis | null) ?? null;
  }, []);

  const fetchHooks = useCallback(async (id: string): Promise<CompetitorHook[]> => {
    const { data } = await supabase
      .from('competitor_hooks')
      .select('*')
      .eq('analysis_id', id)
      .order('view_count', { ascending: false });
    return (data || []) as CompetitorHook[];
  }, []);

  const remove = useCallback(async (id: string) => {
    await supabase.from('competitor_analyses').delete().eq('id', id);
    setAnalyses(prev => prev.filter(a => a.id !== id));
  }, []);

  return { analyses, loading, reload: load, fetchOne, fetchHooks, remove };
}

export function parseInstagramUsername(input: string): string | null {
  const trimmed = input.trim().replace(/^@/, '');
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const username = urlMatch ? urlMatch[1] : trimmed;
  if (!/^[A-Za-z0-9._]{1,40}$/.test(username)) return null;
  return username.toLowerCase();
}
