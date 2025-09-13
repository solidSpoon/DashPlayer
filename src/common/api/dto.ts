import { DateRange } from "react-day-picker";

export type ClipQuery = {
    keyword: string;
    keywordRange: 'context' | 'clip';
    date: DateRange;
}
