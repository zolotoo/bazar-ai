import { ArrowLeft } from 'lucide-react';
import { GlassCard } from './GlassCard';
import type { CompetitorAnalysis } from '../../hooks/useCompetitorAnalysis';

export function ResultView({ analysis, onBack }: { analysis: CompetitorAnalysis; onBack: () => void }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> К списку разборов
      </button>

      <h1 className="text-[24px] md:text-[28px] font-semibold text-[#1a1a18]">
        Разбор @{analysis.competitor_username}
      </h1>
      <p className="text-sm text-slate-500 mt-1">
        Твой аккаунт: @{analysis.user_username}
      </p>

      <GlassCard className="p-6 mt-6">
        <p className="text-sm text-slate-500">
          Топ хуков, tone-of-voice и 10 идей — появятся здесь после подключения API (этап 2).
        </p>
      </GlassCard>
    </div>
  );
}
