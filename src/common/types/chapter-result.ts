export interface ChapterParseResult {
    timestampStart: {
        valid: boolean;
        value: string
    }
    timestampEnd: {
        valid: boolean;
        value: string
    },
    timestampValid: boolean,
    title: string
}
