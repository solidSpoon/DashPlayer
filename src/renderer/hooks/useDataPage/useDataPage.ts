import { create } from 'zustand';
import { Pagination } from '../../../db/service/WordLevelService';
import { WordLevel } from '../../../db/entity/WordLevel';
import { WordLevelRow } from '../../components/ControllerPage/WordLevelPage';
import { DEFAULT_DATA_HOLDER, DEFAULT_WORD_LEVEL } from './Types';

export type PageParam = {
    pageNum: number;
    pageSize: number;
    whereSql?: string;
    orderBySql?: string;
};

export type DataPageData<D, R> = {
    pageParam: PageParam;
    resultPage: Pagination<D>;
    loading: boolean;
    mounted: boolean;
    dataSource: R[];
    readonly loadFunc: (pageParam: PageParam) => Promise<Pagination<D>>;
    readonly toDataSourceFunc: (data: D[], offset?: number) => R[];
    readonly submitFunc: (data: R[]) => Promise<void>;
    readonly addRowsToDs: (ds: R[], num: number) => R[];
};

export type DataPageDataHolder = {
    wordLevel: DataPageData<WordLevel, WordLevelRow>;
    dataHolder: DataPageData<WordLevel, WordLevelRow>;
};

export type DataPageState = {
    data: DataPageDataHolder;
};
export type DataPageAction = {
    updatePageParam: (
        key: keyof DataPageDataHolder,
        param: keyof PageParam,
        value: number | string
    ) => void;
    load: (key: keyof DataPageDataHolder) => Promise<void>;
    submit: (key: keyof DataPageDataHolder) => Promise<void>;
    setDataSource: (
        key: keyof DataPageDataHolder,
        dataSource: DataPageDataHolder[typeof key]['dataSource']
    ) => void;
    addBlankRow: (key: keyof DataPageDataHolder) => void;
    tryMount: (key: keyof DataPageDataHolder) => Promise<void>;
    unmount: (key: keyof DataPageDataHolder) => void;
};

const useDataPage = create<DataPageState & DataPageAction>((set) => ({
    data: {
        wordLevel: DEFAULT_WORD_LEVEL,
        dataHolder: DEFAULT_DATA_HOLDER,
    },
    updatePageParam: (key: keyof DataPageDataHolder, param, value) => {
        console.log('updatePageParam', key, param, value);
        set((state) => {
            const data = state.data[key];
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...data,
                        pageParam: {
                            ...data.pageParam,
                            [param]: value,
                        },
                    },
                },
            };
        });
    },
    load: async (key) => {
        set((state) => {
            const data = state.data[key];
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...data,
                        loading: true,
                    },
                },
            };
        });
        const { pageParam } = useDataPage.getState().data[key];
        const resultPage = await useDataPage
            .getState()
            .data[key].loadFunc(pageParam);
        const dataSource = useDataPage
            .getState()
            .data[key].toDataSourceFunc(resultPage.data, resultPage.offset);
        set((state) => {
            const data = state.data[key];
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...data,
                        resultPage,
                        dataSource,
                        loading: false,
                        mounted: true,
                    },
                },
            };
        });
    },
    submit: async (key: keyof DataPageDataHolder) => {
        set((state) => {
            const data = state.data[key];
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...data,
                        loading: true,
                    },
                },
            };
        });
        const { dataSource } = useDataPage.getState().data[key];
        await useDataPage.getState().data[key].submitFunc(dataSource);
        await useDataPage.getState().load(key);
    },
    setDataSource: (
        key: keyof DataPageDataHolder,
        dataSource: DataPageDataHolder[typeof key]['dataSource']
    ) => {
        set((state) => {
            const data = state.data[key];
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...data,
                        dataSource,
                    },
                },
            };
        });
    },
    addBlankRow: (key: keyof DataPageDataHolder) => {
        set((state) => {
            const data = state.data[key];
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...data,
                        dataSource: useDataPage
                            .getState()
                            .data[key].addRowsToDs(data.dataSource, 1),
                    },
                },
            };
        });
    },
    tryMount: async (key: keyof DataPageDataHolder) => {
        if (!useDataPage.getState().data[key].mounted) {
            await useDataPage.getState().load(key);
        }
    },
    unmount: (key: keyof DataPageDataHolder) => {
        // set to default
        set((state) => {
            const data = state.data[key];
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...data,
                        ...DEFAULT_DATA_HOLDER,
                    },
                },
            };
        });
    },
}));

export default useDataPage;
