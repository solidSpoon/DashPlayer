import { toast } from 'sonner';

type ToastKind = 'error' | 'info' | 'success' | 'warning';

type DedupEntry = {
    id: string;
    count: number;
    lastAt: number;
};

const DEDUP_WINDOW_MS = 15000;
const MAX_ENTRIES = 100;
const MAX_MESSAGE_LENGTH = 240;
const entriesByKey = new Map<string, DedupEntry>();

const hashKey = (key: string) => {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) + hash) ^ key.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
};

const normalizeMessage = (message: string) => {
    const normalized = message.trim().replace(/\s+/g, ' ');
    if (normalized.length <= MAX_MESSAGE_LENGTH) {
        return normalized;
    }
    return `${normalized.slice(0, MAX_MESSAGE_LENGTH)}…`;
};

export function showDedupToast(kind: ToastKind, message: string, options?: { duration?: number }) {
    const normalized = normalizeMessage(message);
    if (!normalized) {
        return;
    }

    const key = `${kind}:${normalized}`;
    const now = Date.now();

    const existing = entriesByKey.get(key);
    const withinWindow = existing && (now - existing.lastAt) <= DEDUP_WINDOW_MS;

    const count = withinWindow ? existing.count + 1 : 1;
    const id = existing?.id ?? `dedup-${hashKey(key)}`;

    entriesByKey.set(key, { id, count, lastAt: now });
    if (entriesByKey.size > MAX_ENTRIES) {
        entriesByKey.clear();
    }

    const title = count > 1 ? `${normalized} (x${count})` : normalized;
    const config = { id, duration: options?.duration };
    switch (kind) {
        case 'success':
            toast.success(title, config);
            break;
        case 'info':
            toast.info(title, config);
            break;
        case 'warning':
            toast.warning(title, config);
            break;
        case 'error':
        default:
            toast.error(title, config);
            break;
    }
}

export function showDedupErrorToast(error: unknown, options?: { duration?: number }) {
    const message =
        error instanceof Error
            ? error.message
            : typeof error === 'string'
                ? error
                : (error as any)?.message
                    ? String((error as any).message)
                    : String(error);

    showDedupToast('error', message, options);
}
