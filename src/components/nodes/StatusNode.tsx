import { Handle, Position, NodeProps } from 'reactflow';
import { Clock, Video, CheckCircle } from 'lucide-react';
import { StatusNodeData } from '../../types';
import { cn } from '../../utils/cn';

const statusConfig = {
  'in-progress': {
    label: 'В работе',
    icon: Clock,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400',
    borderColorOpacity: 'border-yellow-400/30',
  },
  filmed: {
    label: 'Снято',
    icon: Video,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400',
    borderColorOpacity: 'border-blue-400/30',
  },
  published: {
    label: 'Опубликовано',
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-400',
    borderColorOpacity: 'border-green-400/30',
  },
};

export function StatusNode({ data, selected }: NodeProps<StatusNodeData>) {
  const status = data.status || 'in-progress';
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'bg-card/95 backdrop-blur-sm border-2 rounded-xl p-8 min-w-[200px] shadow-xl',
        'flex flex-col items-center justify-center gap-4 transition-all duration-200',
        selected ? `border-primary shadow-[0_0_20px_rgba(59,130,246,0.3)] ${config.bgColor}` : `border-border/50 ${config.bgColor}`
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div className={cn('p-5 rounded-full border-2', config.bgColor, config.borderColorOpacity)}>
        <Icon className={cn('w-10 h-10', config.color)} />
      </div>
      
      <h3 className={cn('text-xl font-bold', config.color)}>
        {config.label}
      </h3>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}
