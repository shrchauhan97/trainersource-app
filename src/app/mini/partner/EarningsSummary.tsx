// src/app/mini/partner/EarningsSummary.tsx
'use client';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

// Next payout: compute next upcoming Friday (matches portal payout cadence from
// spec §9.5). Purely display — actual payout runs are Tim-driven via ACH batch,
// not schedule-driven.
function nextPayoutLabel(now: Date = new Date()): string {
  const day = now.getDay(); // 0 = Sun, 5 = Fri
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilFriday);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(next);
}

type Props = {
  earnings: { pending: number; approved: number; paid: number };
};

export default function EarningsSummary({ earnings }: Props) {
  return (
    <section className="rounded-2xl border border-[var(--tg-hint,#999)]/20 bg-[var(--tg-secondary-bg,#f5f5f7)] p-4">
      <h2 className="text-sm font-bold uppercase tracking-wider opacity-60">This period</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs opacity-60">Pending</p>
          <p className="text-2xl font-black">{formatCurrency(earnings.pending)}</p>
        </div>
        <div>
          <p className="text-xs opacity-60">Paid (last)</p>
          <p className="text-2xl font-black">{formatCurrency(earnings.paid)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs opacity-70">Next payout: {nextPayoutLabel()}</p>
    </section>
  );
}
