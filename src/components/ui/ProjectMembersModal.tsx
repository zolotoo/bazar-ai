import { useState } from 'react';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useAuth } from '@/hooks/useAuth';
import { UserPlus, X, Shield, Edit, Eye, Trash2, Loader2 } from 'lucide-react';
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
  const [inviteUsername, setInviteUsername] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'read' | 'write' | 'admin'>('write');

  const userId = user?.telegram_username ? `tg-@${user.telegram_username}` : null;
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

  const handleRemove = async (memberId: string, username: string) => {
    if (!confirm(`Удалить @${username} из проекта?`)) {
      return;
    }

    try {
      await removeMember(memberId);
      toast.success('Участник удален');
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
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'write': return <Edit className="w-4 h-4" />;
      case 'read': return <Eye className="w-4 h-4" />;
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md mx-4 bg-white/90 backdrop-blur-[28px] backdrop-saturate-[180%] rounded-3xl shadow-2xl border border-white/60"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#f97316] via-[#fb923c] to-[#fdba74] flex items-center justify-center shadow-lg shadow-[#f97316]/20">
              <UserPlus className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Участники проекта</h2>
              <p className="text-xs text-slate-500">{members.length} участников</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar-light">
          {/* Приглашение нового участника */}
          <div className="mb-6 p-4 rounded-2xl bg-slate-50/80 backdrop-blur-sm border border-slate-200/60">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Пригласить участника
            </label>
            
            {/* Поле ввода username - отдельная строка */}
            <div className="mb-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-lg">@</span>
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
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur-sm outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316]/30 transition-all text-slate-800 placeholder:text-slate-400 text-base"
                />
              </div>
            </div>
            
            {/* Роль и кнопка - отдельная строка */}
            <div className="flex items-center gap-2">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as any)}
                className="flex-1 px-4 py-3.5 rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur-sm outline-none focus:ring-2 focus:ring-[#f97316]/20 text-base text-slate-700 font-medium"
              >
                <option value="read">Читатель</option>
                <option value="write">Редактор</option>
                <option value="admin">Администратор</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={!inviteUsername.trim() || isInviting}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#f97316] via-[#fb923c] to-[#fdba74] text-white font-medium hover:from-[#f97316] hover:via-[#fb923c] hover:to-[#fdba74] transition-all shadow-lg shadow-[#f97316]/20 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm flex items-center gap-2 text-base whitespace-nowrap"
              >
                {isInviting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <UserPlus className="w-5 h-5" />
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
              <Loader2 className="w-6 h-6 animate-spin text-[#f97316]" />
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
                        "flex items-center justify-between p-4 rounded-xl border transition-all",
                        member.status === 'pending'
                          ? "bg-amber-50/80 border-amber-200/60"
                          : "bg-white/60 backdrop-blur-sm border-slate-200/60"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f97316] via-[#fb923c] to-[#fdba74] flex items-center justify-center text-white font-bold flex-shrink-0">
                          {username[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800 truncate">
                              @{username}
                            </span>
                            {isCurrentUser && (
                              <span className="px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-medium">
                                Вы
                              </span>
                            )}
                            {member.status === 'pending' && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                                Ожидает
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
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
                            className="px-2 py-1 rounded-lg border border-slate-200/80 bg-white/60 backdrop-blur-sm outline-none focus:ring-2 focus:ring-[#f97316]/20 text-xs text-slate-700"
                          >
                            <option value="read">Читатель</option>
                            <option value="write">Редактор</option>
                            <option value="admin">Администратор</option>
                          </select>
                          <button
                            onClick={() => handleRemove(member.id, username)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            title="Удалить участника"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
