const CATEGORY_PALETTE = [
  { bg: 'bg-blue-500', ring: 'ring-blue-500/30' },
  { bg: 'bg-amber-500', ring: 'ring-amber-500/30' },
  { bg: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
  { bg: 'bg-violet-500', ring: 'ring-violet-500/30' },
  { bg: 'bg-rose-500', ring: 'ring-rose-500/30' },
  { bg: 'bg-cyan-600', ring: 'ring-cyan-600/30' },
  { bg: 'bg-orange-500', ring: 'ring-orange-500/30' },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getCategoryColor(name: string) {
  return CATEGORY_PALETTE[hashString(name) % CATEGORY_PALETTE.length];
}
