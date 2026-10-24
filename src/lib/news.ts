import { BookOpen, RefreshCw, Sparkles, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NewsCategory } from '../types';

export interface NewsCategoryMeta {
  readonly label: string;
  readonly icon: LucideIcon;
}

export const NEWS_CATEGORY_META: Record<NewsCategory, NewsCategoryMeta> = {
  release: { label: 'Релизы', icon: Sparkles },
  guide: { label: 'Гайды', icon: BookOpen },
  community: { label: 'Сообщество', icon: Users },
  update: { label: 'Обновления', icon: RefreshCw },
};

export const NEWS_CATEGORY_OPTIONS = (
  ['release', 'guide', 'community', 'update'] as const satisfies readonly NewsCategory[]
).map((value) => ({
  value,
  label: NEWS_CATEGORY_META[value].label,
}));
