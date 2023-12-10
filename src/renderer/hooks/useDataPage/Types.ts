import { DataPageData } from './useDataPage';
import { WordView } from '../../../db/tables/wordView';
import { createRef } from 'react';
export type MarkupType = 'default' | 'new' | 'delete' | 'update' | 'new-delete';
export interface WordViewRow extends WordView {
    index: number;
    fakeId: number;
    updateColumns: (keyof WordView)[];
}
const onRender = (
    colName: keyof WordView,
    cellProps: any,
    { data }: { data: WordViewRow }
) => {
    cellProps.style.background = data.updateColumns.includes(colName)
        ? '#97aeff'
        : 'inherit';
};

const api = window.electron;
export const DEFAULT_WORD_LEVEL: DataPageData<WordView, WordViewRow> = {
    ele: {
        current: null,
    },
    shouldDiff: false,
    cellSelection: [],
    pageParam: {
        pageNum: 1,
        pageSize: 500,
    },
    resultPage: {
        total: 0,
        perPage: 0,
        offset: 0,
        to: 0,
        lastPage: 0,
        currentPage: 0,
        from: 0,
        data: [],
    },
    loading: false,
    mounted: false,
    dataSource: [],
    loadFunc: async (pageParam) => {
        console.log('loadFunc', pageParam);
        return api.listWordsLevel(
            pageParam.whereSql ?? '1 = 1',
            pageParam.orderBySql ?? 'word',
            pageParam.pageSize,
            pageParam.pageNum
        );
    },
    toDataSourceFunc: (data, offset) => {
        return data.map((item: WordView, index) => ({
            ...item,
            index,
            fakeId: offset ? offset + index : index,
            markup: 'default',
            updateColumns: [],
        }));
    },
    submitFunc: async (ds: WordView[]) => {
        await api.batchUpdateLevelWords(ds);
    },
    addRowsToDs: (ds: WordViewRow[], num: number): WordViewRow[] => {
        console.log('addRowsToDataSource', num);
        const res: WordViewRow[] = [];
        const maxFakeId = Math.max(...ds.map((item) => item.fakeId ?? 0));
        const maxIndex = Math.max(...ds.map((item) => item.index ?? 0));
        for (let i = 0; i < num; i += 1) {
            res.push({
                id: -1,
                stem: '',
                familiar: false,
                index: maxIndex + i + 1,
                fakeId: maxFakeId + i + 1,
                word: '',
                translate: '',
                note: '',
                markup: 'new',
                updateColumns: [],
            });
        }
        return [...ds, ...res];
    },
    keys: [
        'word',
        'translate',
        'familiar',
        'note',
    ],
};

export const DEFAULT_DATA_HOLDER = DEFAULT_WORD_LEVEL;
