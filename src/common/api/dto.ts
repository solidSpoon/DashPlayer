import { DateRange } from "react-day-picker";

export type ClipQuery = {
    keyword: string;
    keywordRange: 'context' | 'clip';
    tags: number[];
    tagsRelation: 'and' | 'or';
    date: DateRange;
    includeNoTag: boolean;
}

