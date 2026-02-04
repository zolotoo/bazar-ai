import { useState } from 'react';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useAuth } from '@/hooks/useAuth';
import { useProjectContext } from '@/contexts/ProjectContext';
import { UserPlus, X, Shield, Edit, Eye, Trash2, Loader2, HelpCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectMembersModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectMembersModal({ projectId, isOpen, onClose }: ProjectMembersModalProps) {
  const { members, loading, inviteMember, removeMember, updateMemberRole } = useProjectMembers(projectId);
  const { user } = useAuth();
  const { refetch: refetchProjects, projects, selectProject } = useProjectContext();
  const [inviteUsername, setInviteUsername] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'read' | 'write' | 'admin'>('write');

  const userId = user?.telegram_username ? `tg-${user.telegram_username}` : null;
  const currentMember = members.find((m: any) => m.user_id === userId);

  const handleInvite = async () => {
    if (!inviteUsername.trim()) {
      toast.error('Введите Telegram username');
      return;
    }

    setIsInviting(true);
    try {
      await inviteMember(inviteUsername.trim(), selectedRole);
      toast.success(`Приглашение отправлено @${inviteUsername.trim()}`);
      setInviteUsername('');
    } catch (error: any) {
      toast.error(error.message || 'Не удалось пригласить участника');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (memberId: string, username: string, isSelf: boolean) => {
    const message = isSelf
      ? 'Выйти из проекта? Вы сможете вернуться только по повторному приглашению.'
      : `Удалить @${username} из проекта?`;
    if (!confirm(message)) return;

    try {
      await removeMember(memberId);
      toast.success(isSelf ? 'Вы вышли из проекта' : 'Участник удален');
      await refetchProjects();
      if (isSelf) {
        const otherProject = projects.find((p: any) => p.id !== projectId);
        if (otherProject) selectProject(otherProject.id);
        onClose();
      }
    } catch (error: any) {
      toast.error(error.message || 'Не удалось удалить участника');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'read' | 'write' | 'admin') => {
    try {
      await updateMemberRole(memberId, newRole);
      toast.success('Роль обновлена');
    } catch (error: any) {
      toast.error(error.message || 'Не удалось изменить роль');
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Администратор';
      case 'write': return 'Редактор';
      case 'read': return 'Читатель';
      default: return role;
    }
  };

  const getRoleIcon = (role: string) => {
    const iconClass = "w-4 h-4 text-slate-500";
    switch (role) {
      case 'admin': return <Shield className={iconClass} />;
      case 'write': return <Edit className={iconClass} />;
      case 'read': return <Eye className={iconClass} />;
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm safe-top safe-bottom safe-left safe-right">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md mx-4 bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border border-slate-200/80"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-slate-600" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 font-heading tracking-[-0.01em]">Участники проекта</h2>
              <p className="text-xs text-slate-500 mt-0.5">{members.length} участников</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -m-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar-light">
          {/* Приглашение нового участника */}
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2 font-heading tracking-[-0.01em]">
              Пригласить участника
            </label>
            
            <div className="mb-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-base">@</span>
                <input
                  type="text"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value.replace('@', ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inviteUsername.trim()) {
                      handleInvite();
                    }
                  }}
                  placeholder="username"
                  className="w-full pl-10 pr-4 py-3.5 min-h-[44px] rounded-2xl border border-slate-200/80 bg-white outline-none focus:ring-2 focus:ring-slate-200/50 focus:border-slate-400/50 transition-all text-slate-800 placeholder:text-slate-400 text-base touch-manipulation"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1 group">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="w-full px-4 py-2.5 min-h-[44px] rounded-2xl border border-slate-200/80 bg-white outline-none focus:ring-2 focus:ring-slate-200/50 focus:border-slate-400/50 text-sm text-slate-700 font-medium pr-10 touch-manipulation"
                >
                  <option value="read">Читатель</option>
                  <option value="write">Редактор</option>
                  <option value="admin">Администратор</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                </div>
                {/* Tooltip при наведении */}
                <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-white border border-slate-200 rounded-2xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                  <div className="space-y-2.5 text-slate-700">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-semibold text-slate-800">Читатель</span>
                      </div>
                      <p className="text-xs text-slate-600 pl-5.5">Только просмотр видео и папок</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Edit className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-semibold text-slate-800">Редактор</span>
                      </div>
                      <p className="text-xs text-slate-600 pl-5.5">Может добавлять, перемещать и удалять видео, создавать папки</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Shield className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-semibold text-slate-800">Администратор</span>
                      </div>
                      <p className="text-xs text-slate-600 pl-5.5">Все права редактора + управление участниками</p>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={handleInvite}
                disabled={!inviteUsername.trim() || isInviting}
                className="px-4 py-2.5 min-h-[44px] rounded-2xl bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap touch-manipulation"
              >
                {isInviting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Пригласить
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mt-3 px-1">
              Введите Telegram username без @ (например: <span className="font-mono text-slate-600">username</span> или <span className="font-mono text-slate-600">@username</span> — оба варианта работают)
            </p>
          </div>

          {/* Список участников */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Нет участников</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {members.map((member: any) => {
                  const username = member.user_id.replace('tg-@', '').replace('tg-', '');
                  const isCurrentUser = member.user_id === userId;
                  const canManage = currentMember?.role === 'admin' || currentMember?.user_id === member.user_id;

                  return (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all",
                        member.status === 'pending'
                          ? "bg-amber-50 border-amber-200/60"
                          : "bg-white border-slate-200/60"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0">
                          {username[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800 truncate font-heading tracking-[-0.01em]">
                              @{username}
                            </span>
                            {isCurrentUser && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                                Вы
                              </span>
                            )}
                            {member.status === 'pending' && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                                Ожидает
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {getRoleIcon(member.role)}
                            <span className="text-xs text-slate-500">{getRoleLabel(member.role)}</span>
                          </div>
                        </div>
                      </div>

                      {canManage && !isCurrentUser && (
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value as any)}
                            className="px-2 py-1 rounded-lg border border-slate-200/80 bg-white outline-none focus:ring-2 focus:ring-slate-200/50 text-xs text-slate-700"
                          >
                            <option value="read">Читатель</option>
                            <option value="write">Редактор</option>
                            <option value="admin">Администратор</option>
                          </select>
                          <button
                            onClick={() => handleRemove(member.id, username, false)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors touch-manipulation"
                            title="Удалить участника"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {isCurrentUser && (
                        <button
                          onClick={() => handleRemove(member.id, username, true)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200/80 hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-600 text-xs font-medium transition-colors touch-manipulation"
                          title="Выйти из проекта"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Выйти
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
