import { useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Sparkles, Save } from 'lucide-react';
import { ScriptNodeData } from '../../types';
import { cn } from '../../utils/cn';

export function ScriptNode({ data, selected }: NodeProps<ScriptNodeData>) {
  const [content, setContent] = useState(data.content || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(data.content || '');
  }, [data.content]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    // TODO: API call to generate script from connected Reference node
    // For now, just a placeholder
    setTimeout(() => {
      setContent('## Генерированный сценарий\n\n[Здесь будет текст сценария, созданный на основе связанного видео]');
      setIsGenerating(false);
    }, 2000);
  };

  const handleSave = () => {
    // Save content to store
    // This will be handled by parent component
  };

  return (
    <div
      className={cn(
        'bg-card/95 backdrop-blur-sm border-2 rounded-xl p-5 min-w-[320px] max-w-[400px] shadow-xl',
        'transition-all duration-200',
        selected ? 'border-primary shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-border/50'
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
        <div>
          <h3 className="text-base font-bold text-foreground">Сценарий</h3>
          <p className="text-xs text-muted-foreground">Создайте текст для видео</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={cn(
              'p-2.5 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5',
              'hover:from-primary/20 hover:to-primary/10 border border-primary/20',
              'text-primary transition-all duration-200 hover:shadow-lg hover:shadow-primary/10',
              isGenerating && 'opacity-50 cursor-not-allowed'
            )}
            title="Сгенерировать через ИИ"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            className="p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border hover:border-border/80 text-foreground transition-all duration-200 hover:shadow-md"
            title="Сохранить"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Text Editor */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Введите текст сценария (Markdown поддерживается)..."
        className="w-full h-64 p-4 bg-background/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200"
        style={{ minHeight: '200px' }}
      />

      {isGenerating && (
        <div className="mt-3 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary flex items-center gap-2">
          <Sparkles className="w-3 h-3 animate-pulse" />
          Генерация сценария...
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}
