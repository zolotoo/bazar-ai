import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { useProjectMembers } from './useProjectMembers';

/**
 * Участники для выбора ответственного: члены проекта + уникальные значения из исходников.
 * Роли (labels) берутся из responsiblesTemplate проекта.
 */
export function useParticipantsForResponsibles(projectId: string | null) {
  const { members } = useProjectMembers(projectId);
  const [valuesFromRefs, setValuesFromRefs] = useState<string[]>([]);

  useEffect(() => {
    if (!projectId) {
      setValuesFromRefs([]);
      return;
    }
    supabase
      .from('saved_videos')
      .select('responsibles, script_responsible, editing_responsible')
      .eq('project_id', projectId)
      .then(({ data }) => {
        const set = new Set<string>();
        for (const row of data || []) {
          const arr = row.responsibles as Array<{ value?: string }> | null;
          if (Array.isArray(arr)) {
            for (const r of arr) {
              const v = (r?.value || '').trim();
              if (v) set.add(v);
            }
          }
          const s = (row.script_responsible || '').trim();
          if (s) set.add(s);
          const e = (row.editing_responsible || '').trim();
          if (e) set.add(e);
        }
        setValuesFromRefs([...set]);
      });
  }, [projectId]);

  const participants = useMemo(() => {
    const set = new Set<string>();
    for (const m of members) {
      const uid = m.user_id || '';
      const isEmail = uid.startsWith('email-');
      const name = isEmail ? uid.replace('email-', '') : `@${uid.replace('tg-@', '').replace('tg-', '')}`;
      if (name) set.add(name);
    }
    for (const v of valuesFromRefs) {
      if (v) set.add(v);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [members, valuesFromRefs]);

  return participants;
}
