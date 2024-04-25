import {strBlank} from "@/common/utils/Util";

export default class TimeUtil {
    public static secondToTimeStrCompact(second: number | null | undefined): string {
        if (second === null || second === undefined) {
            return '';
        }
        const h = Math.floor(second / 3600);
        const m = Math.floor(second % 3600 / 60);
        const s = Math.floor(second % 60);
        return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    }

    /**
     * 00:00:00
     * @param second
     */
    public static secondToTimeStr(second: number | null | undefined): string {
        if (second === null || second === undefined) {
            return '';
        }
        const h = Math.floor(second / 3600);
        const m = Math.floor(second % 3600 / 60);
        const s = Math.floor(second % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    /**
     * 00:00:00.000
     * @param iso
     */
    public static secondToTimeStrWithMs(second: number | null | undefined): string {
        if (second === null || second === undefined) {
            return '';
        }
        const h = Math.floor(second / 3600);
        const m = Math.floor(second % 3600 / 60);
        const s = Math.floor(second % 60);
        const ms = Math.floor((second % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    public static isoToDate(iso: string): Date {
        if (strBlank(iso)) {
            return new Date();
        }
        //iso 2024-04-23T08:57:14.267Z
        console.log('iso', iso);
        const isValidDate = !isNaN(Date.parse(iso));
        const res = isValidDate ? new Date(iso) : new Date(iso.replace(' ', 'T') + 'Z');
        console.log('res', res);
        return res;
    }

    public static dateToRelativeTime(date: Date): string {
        const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

        if (diffInSeconds < 60) {
            return `${diffInSeconds} seconds ago`;
        }

        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) {
            return `${diffInMinutes} minutes ago`;
        }

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
            return `${diffInHours} hours ago`;
        }

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 3) {
            return `${diffInDays} days ago`;
        }

        console.log('date', date);
        return date.toLocaleDateString();
    }

    public static toGroupMiddle(seconds: number): number {
        const segment = Math.floor(seconds / 15);
        return segment * 15 + 7.5;
    }

}
