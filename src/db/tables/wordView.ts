export interface WordView {
    word: string;
    stem: string | null;
    translate: string | null;
    note: string | null;
    familiar: boolean | null;
}
