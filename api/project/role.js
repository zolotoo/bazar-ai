import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { projectId, memberId, role, userId } = req.body;

  if (!projectId || !memberId || !role || !userId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  if (!['read', 'write', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be: read, write, or admin' });
  }

  try {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isOwner = project.owner_id === userId;
    
    if (!isOwner) {
      const { data: member, error: memberError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (memberError && (memberError.code === 'PGRST116' || memberError.message?.includes('relation'))) {
        return res.status(500).json({ error: 'Collaboration tables not set up' });
      }

      if (memberError || !member || member.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    const { data: memberToUpdate, error: memberFetchError } = await supabase
      .from('project_members')
      .select('*')
      .eq('id', memberId)
      .eq('project_id', projectId)
      .single();

    if (memberFetchError) {
      if (memberFetchError.code === 'PGRST116' || memberFetchError.message?.includes('relation')) {
        return res.status(500).json({ error: 'Collaboration tables not set up' });
      }
      return res.status(404).json({ error: 'Member not found' });
    }

    if (!memberToUpdate) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (memberToUpdate.user_id === project.owner_id) {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    const { error: updateError } = await supabase
      .from('project_members')
      .update({ role })
      .eq('id', memberId)
      .eq('project_id', projectId);

    if (updateError) {
      throw updateError;
    }

    // Записываем изменение (если таблица существует)
    try {
      await supabase.from('project_changes').insert({
        project_id: projectId,
        user_id: userId,
        change_type: 'member_role_changed',
        entity_type: 'member',
        entity_id: memberId,
        old_data: { role: memberToUpdate.role },
        new_data: { role },
        vector_clock: {},
      });
    } catch (changeError) {
      // Игнорируем ошибки если таблица не существует
      if (!changeError.message?.includes('relation') && !changeError.message?.includes('does not exist')) {
        console.error('Error recording change:', changeError);
      }
    }

    return res.status(200).json({ 
      success: true,
      message: `Member role updated to ${role}` 
    });

  } catch (error) {
    console.error('Error updating member role:', error);
    return res.status(500).json({ 
      error: 'Failed to update member role',
      details: error.message 
    });
  }
}
