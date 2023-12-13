import { MarkupType } from '../../renderer/hooks/useDataPage/Types';

export interface WordView {
    id: number;
    word: string;
    stem: string | null;
    translate: string | null;
    note: string | null;
    familiar: boolean | null;
    markup: MarkupType;
}
