// src/app/mini/partner/CodesList.tsx
'use client';

type Code = {
  id: string;
  code: string;
  displayStatus: 'active' | 'consumed' | 'expired';
  consumedByName: string | null;
  created_at: string;
  expires_at: string;
};

type Props = {
  codes: Code[];
  total: number;
};

const VISIBLE_LIMIT = 4;

export default function CodesList({ codes, total }: Props) {
  const visible = codes.slice(0, VISIBLE_LIMIT);
  const remainder = Math.max(0, total - visible.length);

  return (
    <section className="rounded-2xl border border-[var(--tg-hint,#999)]/20 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wider opacity-60">
        Active codes ({total})
      </h2>
      {visible.length === 0 ? (
        <p className="mt-3 text-sm opacity-70">
          No active codes yet. Tap the MainButton below to issue your first.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((c) => (
            <li key={c.id} className="flex items-center justify-between text-sm">
              <span className="font-mono tracking-wide">{c.code}</span>
              <span className="text-xs opacity-60">
                {c.consumedByName ? `→ ${c.consumedByName}` : 'unused'}
              </span>
            </li>
          ))}
          {remainder > 0 && (
            <li className="text-xs opacity-60 pt-1">+ {remainder} more (see full portal)</li>
          )}
        </ul>
      )}
    </section>
  );
}
