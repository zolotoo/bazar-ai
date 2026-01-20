import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';

export interface WorkspaceZone {
  id: string;
  name: string;
  color: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  sort_order: number;
}

export interface ZoneVideo {
  id: string;
  title: string;
  preview_url: string;
  url: string;
  zone_id: string | null;
  position_x: number;
  position_y: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  owner_username?: string;
  status: string;
}

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return !!(url && key && url !== 'https://placeholder.supabase.co');
};

export function useWorkspaceZones() {
  const [zones, setZones] = useState<WorkspaceZone[]>([]);
  const [videos, setVideos] = useState<ZoneVideo[]>([]);
  const [loading, setLoading] = useState(true);

  // Загрузка зон
  const fetchZones = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      // Дефолтные зоны для локальной работы
      setZones([
        { id: '1', name: '📥 Входящие', color: '#6366f1', position_x: 0, position_y: 0, width: 300, height: 500, sort_order: 0 },
        { id: '2', name: '⭐ Избранное', color: '#f59e0b', position_x: 350, position_y: 0, width: 300, height: 500, sort_order: 1 },
        { id: '3', name: '📝 В работе', color: '#10b981', position_x: 700, position_y: 0, width: 300, height: 500, sort_order: 2 },
        { id: '4', name: '✅ Готово', color: '#8b5cf6', position_x: 1050, position_y: 0, width: 300, height: 500, sort_order: 3 },
      ]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('workspace_zones')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setZones(data || []);
    } catch (err) {
      console.error('Error fetching zones:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Загрузка видео
  const fetchVideos = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setVideos([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('inbox_videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (err) {
      console.error('Error fetching videos:', err);
    }
  }, []);

  // Перемещение видео в зону
  const moveVideoToZone = useCallback(async (videoId: string, zoneId: string | null) => {
    // Оптимистичное обновление
    setVideos(prev => prev.map(v => 
      v.id === videoId ? { ...v, zone_id: zoneId } : v
    ));

    if (!isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('inbox_videos')
        .update({ zone_id: zoneId, updated_at: new Date().toISOString() })
        .eq('id', videoId);

      if (error) throw error;
    } catch (err) {
      console.error('Error moving video:', err);
      // Откат при ошибке
      fetchVideos();
    }
  }, [fetchVideos]);

  // Удаление видео
  const deleteVideo = useCallback(async (videoId: string) => {
    setVideos(prev => prev.filter(v => v.id !== videoId));

    if (!isSupabaseConfigured()) return;

    try {
      await supabase
        .from('inbox_videos')
        .delete()
        .eq('id', videoId);
    } catch (err) {
      console.error('Error deleting video:', err);
    }
  }, []);

  // Получение видео по зоне
  const getVideosByZone = useCallback((zoneId: string | null) => {
    return videos.filter(v => v.zone_id === zoneId);
  }, [videos]);

  // Подписка на изменения в реальном времени
  useEffect(() => {
    fetchZones();
    fetchVideos();

    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('workspace_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_videos' }, () => {
        fetchVideos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_zones' }, () => {
        fetchZones();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchZones, fetchVideos]);

  return {
    zones,
    videos,
    loading,
    moveVideoToZone,
    deleteVideo,
    getVideosByZone,
    refetch: () => { fetchZones(); fetchVideos(); },
  };
}
