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

  const { projectId, username, userId } = req.body;

  if (!projectId || !username || !userId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Проверяем права пользователя (владелец или админ)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('Error fetching project:', projectError);
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isOwner = project.owner_id === userId;
    
    if (!isOwner) {
      // Проверяем, является ли пользователь админом
      const { data: member, error: memberError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      // Если таблица не существует, разрешаем только владельцу
      if (memberError && (memberError.code === 'PGRST116' || memberError.message?.includes('relation') || memberError.message?.includes('does not exist'))) {
        console.warn('[Invite] Table project_members does not exist. Only owner can invite.');
        return res.status(403).json({ error: 'Collaboration tables not set up. Please run migrations.' });
      }

      if (memberError || !member || member.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    // Нормализуем username
    const inviteeId = username.startsWith('@') 
      ? `tg-${username}` 
      : `tg-@${username}`;

    // Проверяем, не добавлен ли уже участник
    const { data: existing, error: existingError } = await supabase
      .from('project_members')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('user_id', inviteeId)
      .maybeSingle();

    // Если таблица не существует, возвращаем ошибку
    if (existingError && (existingError.code === 'PGRST116' || existingError.message?.includes('relation') || existingError.message?.includes('does not exist'))) {
      return res.status(500).json({ 
        error: 'Collaboration tables not set up',
        message: 'Please run the migration: create_collaboration_tables.sql in your Supabase database'
      });
    }

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError;
    }

    if (existing) {
      if (existing.status === 'active') {
        return res.status(400).json({ error: 'User is already a member' });
      }
      // Если был удален, активируем снова
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

    // Создаем новую запись участника
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
      console.error('Error inserting member:', insertError);
      throw insertError;
    }

    // Записываем изменение (если таблица существует)
    try {
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
    } catch (changeError) {
      // Игнорируем ошибки если таблица не существует
      if (!changeError.message?.includes('relation') && !changeError.message?.includes('does not exist')) {
        console.error('Error recording change:', changeError);
      }
    }

    // Обновляем флаг is_shared проекта
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
