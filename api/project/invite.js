import { createClient } from '@supabase/supabase-js';

// Переменные окружения читаются внутри handler для каждого запроса
// Это гарантирует, что они будут доступны после добавления в Vercel без перезапуска

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

  // Проверяем переменные окружения (читаем их заново на каждый запрос)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Проверяем переменные окружения
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Invite] Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey,
      envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
    });
    return res.status(500).json({ 
      error: 'Supabase not configured',
      message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables',
      hint: 'Please add these variables in Vercel Settings → Environment Variables and redeploy'
    });
  }

  // Создаем клиент Supabase с переменными окружения
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { projectId, username, userId, role = 'write' } = req.body;

  console.log('[Invite] Request received:', { projectId, username, userId });

  if (!projectId || !username || !userId) {
    return res.status(400).json({ 
      error: 'Missing required parameters',
      received: { projectId: !!projectId, username: !!username, userId: !!userId }
    });
  }

  try {
    // Проверяем права пользователя (владелец или админ)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('[Invite] Error fetching project:', projectError);
      return res.status(404).json({ error: 'Project not found', details: projectError.message });
    }

    if (!project) {
      console.error('[Invite] Project not found:', projectId);
      return res.status(404).json({ error: 'Project not found' });
    }

    const isOwner = project.owner_id === userId;
    console.log('[Invite] Project owner check:', { projectId, userId, ownerId: project.owner_id, isOwner });
    
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

      if (memberError) {
        console.error('[Invite] Error checking member:', memberError);
        return res.status(500).json({ error: 'Failed to check permissions', details: memberError.message });
      }

      if (!member || member.role !== 'admin') {
        console.warn('[Invite] Insufficient permissions:', { userId, member });
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    // Нормализуем username: убираем @, lowercase (как в сессии при логине)
    const rawUsername = username.startsWith('@') ? username.slice(1) : username;
    const normalizedInviteeId = `tg-${rawUsername.trim().toLowerCase()}`;
    
    console.log('[Invite] Normalized invitee ID:', { username, normalizedInviteeId });

    // Проверяем, не добавлен ли уже участник
    const { data: existing, error: existingError } = await supabase
      .from('project_members')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('user_id', normalizedInviteeId)
      .maybeSingle();

    // Если таблица не существует, возвращаем ошибку
    if (existingError && (existingError.code === 'PGRST116' || existingError.message?.includes('relation') || existingError.message?.includes('does not exist'))) {
      console.error('[Invite] Table project_members does not exist');
      return res.status(500).json({ 
        error: 'Collaboration tables not set up',
        message: 'Please run the migration: create_collaboration_tables.sql in your Supabase database'
      });
    }

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('[Invite] Error checking existing member:', existingError);
      throw existingError;
    }

    if (existing) {
      if (existing.status === 'active') {
        return res.status(400).json({ error: 'User is already a member' });
      }
      // Если был удален, активируем снова (user_id приводим к lowercase для совпадения с сессией)
      const validRole = ['read', 'write', 'admin'].includes(role) ? role : 'write';
      const { error: updateError } = await supabase
        .from('project_members')
        .update({
          status: 'active',
          role: validRole,
          user_id: normalizedInviteeId,
          joined_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('[Invite] Error reactivating member:', updateError);
        throw updateError;
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Member reactivated',
        memberId: existing.id 
      });
    }

    // Создаем новую запись участника
    const validRole = ['read', 'write', 'admin'].includes(role) ? role : 'write';
    console.log('[Invite] Creating new member:', { projectId, normalizedInviteeId, userId, role: validRole });
    const { data: member, error: insertError } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: normalizedInviteeId,
        role: validRole,
        invited_by: userId,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Invite] Error inserting member:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      return res.status(500).json({ 
        error: 'Failed to invite member',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      });
    }

    if (!member) {
      console.error('[Invite] Member insert returned no data');
      return res.status(500).json({ 
        error: 'Failed to invite member',
        details: 'Insert succeeded but no member data returned'
      });
    }

    console.log('[Invite] Member created successfully:', member.id);

    // Записываем изменение (если таблица существует)
    try {
      await supabase.from('project_changes').insert({
        project_id: projectId,
        user_id: userId,
        change_type: 'member_added',
        entity_type: 'member',
        entity_id: member.id,
        old_data: null,
        new_data: { user_id: normalizedInviteeId, role: validRole },
        vector_clock: {},
      });
    } catch (changeError) {
      // Игнорируем ошибки если таблица не существует
      if (!changeError.message?.includes('relation') && !changeError.message?.includes('does not exist')) {
        console.error('[Invite] Error recording change:', changeError);
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
    console.error('[Invite] Unexpected error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({ 
      error: 'Failed to invite member',
      details: error.message,
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
