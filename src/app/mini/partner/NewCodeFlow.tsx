// src/app/mini/partner/NewCodeFlow.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function getTg(): TelegramWebAppM3 | null {
  if (typeof window === 'undefined') return null;
  return (window.Telegram?.WebApp as TelegramWebAppM3 | undefined) ?? null;
}

type IssueCodeResponse = {
  id: string;
  code: string;
  label: string;
  landing_url: string;
  deep_link: string;
  qr_url: string;
  expires_at: string;
};

type FlowState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'issued'; data: IssueCodeResponse }
  | { kind: 'error'; message: string };

type Props = {
  onIssued?: () => void;
};

export default function NewCodeFlow({ onIssued }: Props) {
  const [state, setState] = useState<FlowState>({ kind: 'idle' });
  const handlerRef = useRef<(() => void) | null>(null);

  const issueCode = useCallback(
    async (label: string) => {
      const tg = getTg();
      if (!tg) return;
      tg.MainButton.showProgress();
      setState({ kind: 'submitting' });
      try {
        const res = await fetch('/api/mini/partner/issue-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': tg.initData,
          },
          body: JSON.stringify({ label }),
        });
        if (!res.ok) {
          const body = await res.text();
          setState({ kind: 'error', message: `${res.status} ${body.slice(0, 120)}` });
          tg.HapticFeedback?.notificationOccurred('error');
          return;
        }
        const data = (await res.json()) as IssueCodeResponse;
        setState({ kind: 'issued', data });
        tg.HapticFeedback?.notificationOccurred('success');
        onIssued?.();
      } catch (err) {
        setState({ kind: 'error', message: (err as Error).message });
        tg.HapticFeedback?.notificationOccurred('error');
      } finally {
        tg.MainButton.hideProgress();
      }
    },
    [onIssued],
  );

  const promptForLabel = useCallback(() => {
    const tg = getTg();
    if (!tg) return;
    // Telegram showPopup cannot collect free text — fall through to
    // window.prompt inside the webview (works on both iOS and Android since
    // Bot API 6.2).
    const label = window.prompt('Client name or label for this code:');
    if (!label || !label.trim()) return;
    void issueCode(label.trim());
  }, [issueCode]);

  useEffect(() => {
    const tg = getTg();
    if (!tg) return;

    const handler = () => {
      promptForLabel();
    };
    handlerRef.current = handler;

    tg.MainButton.setText('+ New code');
    tg.MainButton.show();
    tg.MainButton.enable();
    tg.MainButton.onClick(handler);

    return () => {
      if (handlerRef.current) tg.MainButton.offClick(handlerRef.current);
      tg.MainButton.hide();
    };
  }, [promptForLabel]);

  function shareCode() {
    if (state.kind !== 'issued') return;
    const tg = getTg();
    if (!tg) return;
    // switchInlineQuery opens the Telegram contact picker with a pre-filled
    // inline query. The user picks a chat; Telegram triggers the bot's inline
    // handler, which returns a share card. If the bot doesn't implement inline
    // mode, this is still the right UX primitive — it opens the share sheet.
    const msg = `Use my code ${state.data.code} — ${state.data.deep_link}`;
    tg.switchInlineQuery(msg, ['users', 'groups']);
  }

  if (state.kind === 'idle' || state.kind === 'submitting') {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--tg-hint,#999)]/30 p-4 text-center">
        <p className="text-xs opacity-60">
          {state.kind === 'submitting'
            ? 'Issuing code…'
            : 'Tap the + New code button below to create a code.'}
        </p>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4 text-center">
        <p className="text-sm font-semibold">Couldn&apos;t issue code</p>
        <p className="mt-1 text-xs font-mono opacity-70 break-all">{state.message}</p>
        <button
          onClick={() => setState({ kind: 'idle' })}
          className="mt-2 text-xs underline opacity-70"
        >
          Try again
        </button>
      </section>
    );
  }

  // state.kind === 'issued'
  return (
    <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-center space-y-2">
      <p className="text-sm font-semibold">Code created</p>
      <p className="font-mono text-xl tracking-wider">{state.data.code}</p>
      <p className="text-xs opacity-70 break-all">{state.data.deep_link}</p>
      <div className="flex gap-2 justify-center pt-1">
        <button
          onClick={shareCode}
          className="rounded-full bg-[var(--tg-button,#2481CC)] text-[var(--tg-button-text,#fff)] px-4 py-1.5 text-sm font-semibold"
        >
          Share
        </button>
        <button
          onClick={() => setState({ kind: 'idle' })}
          className="rounded-full border border-[var(--tg-hint,#999)]/40 px-4 py-1.5 text-sm"
        >
          Done
        </button>
      </div>
    </section>
  );
}
