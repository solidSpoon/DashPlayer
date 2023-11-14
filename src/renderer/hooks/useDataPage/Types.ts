import { WordLevel } from '../../../db/entity/WordLevel';
import { WordLevelRow } from '../../components/ControllerPage/WordLevelPage';
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
        }));
    },
    submitFunc: async () => {},
};

export const DEFAULT_DATA_HOLDER = DEFAULT_WORD_LEVEL;
