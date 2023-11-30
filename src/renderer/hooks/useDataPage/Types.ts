import { WordLevel } from '../../../db/entity/WordLevel';
import { WordViewRow } from '../../components/ControllerPage/WordLevelPage';
import { DataPageData } from './useDataPage';
import { WordView } from '../../../db/entity/WordView';

const onRender = (
    colName: keyof WordView,
    cellProps: any,
    { data }: { data: WordViewRow }
) => {
    cellProps.style.background = data.updateColumns.includes(colName)
        ? '#97aeff'
        : 'inherit';
};
export const defaultColumns = [
    {
        name: 'fakeId',
        header: '',
        minWidth: 50,
        maxWidth: 50,
        type: 'number',
        editable: false,
    },
    {
        name: 'word',
        header: 'Word',
        minWidth: 50,
        defaultFlex: 1,
        onRender: onRender.bind(null, 'word'),
    },
    {
        name: 'familiar',
        header: 'Familiar',
        minWidth: 50,
        maxWidth: 100,
        type: 'boolean',
    },
    {
        name: 'translate',
        header: 'Translation',
        maxWidth: 1000,
        defaultFlex: 1,
        onRender: onRender.bind(null, 'translate'),
    },
    {
        name: 'note',
        header: 'Note',
        minWidth: 100,
        defaultFlex: 2,
        onRender: onRender.bind(null, 'note'),
    },
];

const api = window.electron;
export const DEFAULT_WORD_LEVEL: DataPageData<WordLevel, WordViewRow> = {
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
            pageParam.orderBySql ?? 'word',
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
    submitFunc: async (ds:WordLevel[]) => {
        await api.batchUpdateLevelWords(ds);
    },
    addRowsToDs: (ds: WordViewRow[], num: number): WordViewRow[] => {
        console.log('addRowsToDataSource', num);
        const res: WordViewRow[] = [];
        const maxFakeId = Math.max(...ds.map((item) => item.fakeId ?? 0));
        const maxIndex = Math.max(...ds.map((item) => item.index ?? 0));
        for (let i = 0; i < num; i += 1) {
            res.push({
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
};

export const DEFAULT_DATA_HOLDER = DEFAULT_WORD_LEVEL;
