import React, { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

type RendererToastVariant = 'default' | 'success' | 'info' | 'warning' | 'error';
type RendererToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

type RendererToastEventDetail = {
    title?: string;
    message: string;
    variant?: RendererToastVariant;
    duration?: number;
    position?: RendererToastPosition;
    bubble?: boolean;
    dedupeKey?: string;
    id?: string;
};

function hashString(input: string): string {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
}

function resolveToastId(detail: RendererToastEventDetail): string {
    if (detail.id) return detail.id;
    if (detail.dedupeKey) return `dedupe:${detail.dedupeKey}`;
    const basis = `${detail.variant ?? 'default'}|${detail.title ?? ''}|${detail.message}`;
    return `msg:${hashString(basis)}`;
}

function BubbleToastContent(props: {
    title?: string;
    message: string;
    variant: RendererToastVariant;
    count: number;
}) {
    const { title, message, variant, count } = props;
    const toneClass = (() => {
        switch (variant) {
            case 'success':
                return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-50';
            case 'info':
                return 'border-sky-500/30 bg-sky-500/10 text-sky-50';
            case 'warning':
                return 'border-amber-500/30 bg-amber-500/10 text-amber-50';
            case 'error':
                return 'border-red-500/30 bg-red-500/10 text-red-50';
            case 'default':
            default:
                return 'border-white/15 bg-zinc-900/90 text-zinc-50';
        }
    })();

    return (
        <div className={`relative rounded-xl border px-3 py-2 shadow-lg backdrop-blur ${toneClass}`}>
            <div className="absolute left-3 top-0 -translate-y-1/2 h-2.5 w-2.5 rotate-45 bg-inherit" />
            <div className="flex items-start gap-2">
                <div className="min-w-0">
                    {title ? <div className="text-sm font-medium leading-5">{title}</div> : null}
                    <div className="text-sm leading-5 opacity-95 break-words">{message}</div>
                </div>
                {count > 1 ? (
                    <div className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs leading-4 text-white/80">
                        x{count}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function RendererToastHost() {
    const countsRef = useRef<Map<string, number>>(new Map());
    const lastShownAtRef = useRef<Map<string, number>>(new Map());
    const activeUntilRef = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        const handler = (event: Event) => {
            const customEvent = event as CustomEvent<RendererToastEventDetail>;
            const detail = customEvent.detail;
            if (!detail || !detail.message) return;

            const id = resolveToastId(detail);
            const variant = detail.variant ?? 'default';
            const position = detail.position ?? 'top-left';
            const duration = detail.duration ?? 4500;
            const bubble = detail.bubble ?? true;

            const now = Date.now();
            lastShownAtRef.current.set(id, now);

            const activeUntil = activeUntilRef.current.get(id) ?? 0;
            const isActive = activeUntil > now;
            const nextCount = (() => {
                const prev = countsRef.current.get(id) ?? 0;
                return isActive ? prev + 1 : 1;
            })();
            countsRef.current.set(id, nextCount);
            activeUntilRef.current.set(id, now + duration + 250);

            const content = (
                <BubbleToastContent
                    title={detail.title}
                    message={detail.message}
                    variant={variant}
                    count={nextCount}
                />
            );

            if (bubble) {
                toast.custom(() => content, { id, duration, position });
            } else {
                const text = detail.title ? `${detail.title}: ${detail.message}` : detail.message;
                if (variant === 'success') toast.success(text, { id, duration, position });
                else if (variant === 'error') toast.error(text, { id, duration, position });
                else toast(text, { id, duration, position });
            }

            if (countsRef.current.size > 80) {
                const cutoff = now - 10 * 60 * 1000;
                for (const [key, ts] of lastShownAtRef.current.entries()) {
                    if (ts < cutoff) {
                        lastShownAtRef.current.delete(key);
                        countsRef.current.delete(key);
                        activeUntilRef.current.delete(key);
                    }
                }
            }
        };

        window.addEventListener('show-toast', handler);
        return () => window.removeEventListener('show-toast', handler);
    }, []);

    return null;
}
