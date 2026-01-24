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

  const { projectId, username, userId } = req.body;

  if (!projectId || !username || !userId) {
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

    const inviteeId = username.startsWith('@') 
      ? `tg-${username}` 
      : `tg-@${username}`;

    const { data: existing } = await supabase
      .from('project_members')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('user_id', inviteeId)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'active') {
        return res.status(400).json({ error: 'User is already a member' });
      }
      const { error: updateError } = await supabase
        .from('project_members')
        .update({
          status: 'active',
          role: 'write',
          joined_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        throw updateError;
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Member reactivated',
        memberId: existing.id 
      });
    }

    const { data: member, error: insertError } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: inviteeId,
        role: 'write',
        invited_by: userId,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    await supabase.from('project_changes').insert({
      project_id: projectId,
      user_id: userId,
      change_type: 'member_added',
      entity_type: 'member',
      entity_id: member.id,
      old_data: null,
      new_data: { user_id: inviteeId, role: 'write' },
      vector_clock: {},
    });

    await supabase
      .from('projects')
      .update({ 
        is_shared: true,
        shared_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    return res.status(200).json({ 
      success: true, 
      member,
      message: `Invitation sent to ${username}` 
    });

  } catch (error) {
    console.error('Error inviting member:', error);
    return res.status(500).json({ 
      error: 'Failed to invite member',
      details: error.message 
    });
  }
}
