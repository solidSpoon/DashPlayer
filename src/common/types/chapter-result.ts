export interface ParseResult {
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
