import { WordLevel } from '../../../db/entity/WordLevel';
import { defaultColumns, WordLevelRow } from '../../components/ControllerPage/WordLevelPage';
import { DataPageData } from './useDataPage';

const api = window.electron;
export const DEFAULT_WORD_LEVEL: DataPageData<WordLevel, WordLevelRow> = {
    pageParam: {
        pageNum: 1,
        pageSize: 10,
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
    cellSelection: {
        '1,word': true,
    },
    columOrder: defaultColumns.map((item) => item.name),
    loadFunc: async (pageParam) => {
        console.log('loadFunc', pageParam);
        return api.listWordsLevel(
            pageParam.whereSql ?? '1 = 1',
            pageParam.orderBySql ?? 'id desc',
            pageParam.pageSize,
            pageParam.pageNum
        );
    },
    toDataSourceFunc: (data, offset) => {
        return data.map((item: WordLevel, index) => ({
            ...item,
            index,
            fakeId: offset ? offset + index : index,
            markup: 'default',
            updateColumns: [],
        }));
    },
    submitFunc: async () => {},
    addRowsToDs: (ds: WordLevelRow[], num: number): WordLevelRow[] => {
        console.log('addRowsToDataSource', num);
        const res: WordLevelRow[] = [];
        const maxId = Math.max(...ds.map((item) => item.id ?? 0));
        const maxFakeId = Math.max(...ds.map((item) => item.fakeId ?? 0));
        const maxIndex = Math.max(...ds.map((item) => item.index ?? 0));
        for (let i = 0; i < num; i += 1) {
            res.push({
                id: maxId + i + 1,
                index: maxIndex + i + 1,
                fakeId: maxFakeId + i + 1,
                word: '',
                translate: '',
                note: '',
                level: 2,
                markup: 'new',
                updateColumns: [],
            });
        }
        return [...ds, ...res];
    },
};

export const DEFAULT_DATA_HOLDER = DEFAULT_WORD_LEVEL;
