import { Users } from 'lucide-react';
import { useFlowStore } from '../../stores/flowStore';

export function ActiveUsers() {
  const { users } = useFlowStore();
  const userList = Array.from(users.values());

  if (userList.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-6 z-20 bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl p-4 shadow-2xl">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">
          Онлайн: {userList.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {userList.map((user, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50 hover:bg-secondary transition-colors"
          >
            <div
              className="w-2.5 h-2.5 rounded-full ring-2 ring-offset-2 ring-offset-card"
              style={{ backgroundColor: user.color }}
            />
            <span className="text-xs font-medium text-foreground truncate max-w-[100px]">
              {user.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
