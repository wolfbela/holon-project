'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getCategoryColor } from './category-colors';

interface CategoryFilterProps {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  counts?: Record<string, number>;
}

export function CategoryFilter({
  categories,
  selected,
  onSelect,
  counts,
}: CategoryFilterProps) {
  const total = counts
    ? Object.values(counts).reduce((a, b) => a + b, 0)
    : undefined;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <Button
        size="sm"
        variant={selected === null ? 'default' : 'outline'}
        className="shrink-0 rounded-full"
        onClick={() => onSelect(null)}
      >
        All{total !== undefined && ` (${total})`}
      </Button>
      {categories.map((category) => {
        const isActive = selected === category;
        const color = getCategoryColor(category);
        const count = counts?.[category];

        return (
          <Button
            key={category}
            size="sm"
            variant={isActive ? 'default' : 'outline'}
            className={cn(
              'shrink-0 rounded-full',
              isActive && `${color.bg} text-white border-transparent hover:opacity-90`,
            )}
            onClick={() => onSelect(isActive ? null : category)}
          >
            {category}
            {count !== undefined && ` (${count})`}
          </Button>
        );
      })}
    </div>
  );
}
