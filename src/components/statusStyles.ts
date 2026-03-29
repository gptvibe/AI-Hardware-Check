import type {
  CompatibilityStatus,
  HardwareReadinessTone,
  RecommendationTone,
} from '../domain'

export const readinessStyles: Record<HardwareReadinessTone, string> = {
  great: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  good: 'bg-teal-100 text-teal-700 border border-teal-200',
  possible: 'bg-amber-100 text-amber-700 border border-amber-200',
  unlikely: 'bg-rose-100 text-rose-700 border border-rose-200',
  unknown: 'bg-slate-100 text-slate-600 border border-slate-200',
}

export const compatibilityStyles: Record<CompatibilityStatus, string> = {
  'Can Run': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  Maybe: 'bg-amber-100 text-amber-700 border border-amber-200',
  'Cannot Run': 'bg-rose-100 text-rose-700 border border-rose-200',
  Unknown: 'bg-slate-100 text-slate-600 border border-slate-200',
}

export const recommendationStyles: Record<RecommendationTone, string> = {
  good: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  borderline: 'bg-amber-100 text-amber-700 border border-amber-200',
  bad: 'bg-rose-100 text-rose-700 border border-rose-200',
  unknown: 'bg-slate-100 text-slate-600 border border-slate-200',
}
