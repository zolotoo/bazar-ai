import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

  const { projectId, memberId, userId } = req.body;

  if (!projectId || !memberId || !userId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isOwner = project.owner_id === userId;
    
    if (!isOwner) {
      const { data: member } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (!member || member.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    const { data: memberToRemove } = await supabase
      .from('project_members')
      .select('*')
      .eq('id', memberId)
      .eq('project_id', projectId)
      .single();

    if (!memberToRemove) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (memberToRemove.user_id === project.owner_id) {
      return res.status(400).json({ error: 'Cannot remove project owner' });
    }

    const { error: removeError } = await supabase
      .from('project_members')
      .update({ status: 'removed' })
      .eq('id', memberId)
      .eq('project_id', projectId);

    if (removeError) {
      throw removeError;
    }

    await supabase.from('project_changes').insert({
      project_id: projectId,
      user_id: userId,
      change_type: 'member_removed',
      entity_type: 'member',
      entity_id: memberId,
      old_data: { user_id: memberToRemove.user_id, role: memberToRemove.role },
      new_data: null,
      vector_clock: {},
    });

    return res.status(200).json({ 
      success: true,
      message: 'Member removed successfully' 
    });

  } catch (error) {
    console.error('Error removing member:', error);
    return res.status(500).json({ 
      error: 'Failed to remove member',
      details: error.message 
    });
  }
}
