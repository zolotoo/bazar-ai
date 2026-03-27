import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import type { ProjectReel } from './useProjectAnalytics';

type ResponsibleRow = { templateId?: string; label?: string; value: string };
type LinkRow = { templateId?: string; label?: string; value: string };

export interface ResponsiblesStat {
  role: string;
  person: string;
  /** Кол-во опубликованных роликов в аналитике */
  views: number;
  reelsCount: number;
  /** Кол-во видео в saved_videos с этим ответственным (включая неопубликованные) */
  assignedCount: number;
  /** Кол-во видео у этого ответственного, где заполнена хоть одна ссылка */
  linksFilledCount: number;
}

type VideoRow = {
  shortcode: string | null;
  responsibles: ResponsibleRow[] | null;
  script_responsible: string | null;
  editing_responsible: string | null;
  links: LinkRow[] | null;
  draft_link: string | null;
  final_link: string | null;
};

/** Load saved_videos responsibles for project, match with reels by shortcode, aggregate views by (role, person) */
export function useResponsiblesStats(projectId: string | null, reels: ProjectReel[]) {
  const [videoRows, setVideoRows] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setVideoRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('saved_videos')
      .select('shortcode, responsibles, script_responsible, editing_responsible, links, draft_link, final_link')
      .eq('project_id', projectId)
      .then(({ data, error }) => {
        if (cancelled || error) {
          setVideoRows([]);
          setLoading(false);
          return;
        }
        setVideoRows((data || []) as VideoRow[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  /** Parse responsible rows from a video row */
  const parseResponsibles = (row: VideoRow): ResponsibleRow[] => {
    const arr = row.responsibles;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.filter((r) => r?.value).map((r) => ({
        templateId: r.templateId,
        label: r.label || 'Ответственный',
        value: r.value,
      }));
    }
    const legacy: ResponsibleRow[] = [];
    if (row.script_responsible) legacy.push({ templateId: 'resp-0', label: 'За сценарий', value: row.script_responsible });
    if (row.editing_responsible) legacy.push({ templateId: 'resp-1', label: 'За монтаж', value: row.editing_responsible });
    return legacy;
  };

  /** Check if a video row has at least one filled link */
  const hasFilledLink = (row: VideoRow): boolean => {
    const arr = row.links;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.some((l) => l?.value?.trim());
    }
    return !!(row.draft_link?.trim() || row.final_link?.trim());
  };

  const reelViewsByShortcode = useMemo(() => {
    const m = new Map<string, { views: number; count: number }>();
    for (const reel of reels) {
      if (reel.shortcode) {
        m.set(reel.shortcode, { views: reel.latest_view_count ?? 0, count: 1 });
      }
    }
    return m;
  }, [reels]);

  const stats = useMemo((): ResponsiblesStat[] => {
    // key = "role::person"
    const byKey = new Map<string, { views: number; reelsCount: number; assignedCount: number; linksFilledCount: number }>();

    for (const row of videoRows) {
      const rows = parseResponsibles(row);
      if (!rows.length) continue;
      const filled = hasFilledLink(row);
      const reel = row.shortcode ? reelViewsByShortcode.get(row.shortcode) : undefined;

      for (const r of rows) {
        const label = (r.label || 'Ответственный').trim();
        const value = (r.value || '').trim();
        if (!value) continue;
        const key = `${label}::${value}`;
        const cur = byKey.get(key) || { views: 0, reelsCount: 0, assignedCount: 0, linksFilledCount: 0 };
        byKey.set(key, {
          views: cur.views + (reel?.views ?? 0),
          reelsCount: cur.reelsCount + (reel ? 1 : 0),
          assignedCount: cur.assignedCount + 1,
          linksFilledCount: cur.linksFilledCount + (filled ? 1 : 0),
        });
      }
    }

    return [...byKey.entries()]
      .map(([key, val]) => {
        const [role, person] = key.split('::');
        return { role, person, ...val };
      })
      .sort((a, b) => b.assignedCount - a.assignedCount || b.views - a.views);
  }, [videoRows, reelViewsByShortcode]);

  const byRole = useMemo(() => {
    const m = new Map<string, ResponsiblesStat[]>();
    for (const s of stats) {
      const list = m.get(s.role) || [];
      list.push(s);
      m.set(s.role, list);
    }
    return m;
  }, [stats]);

  return { stats, byRole, loading };
}
