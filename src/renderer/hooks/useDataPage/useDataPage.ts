import { create } from 'zustand';
import { CellRange } from 'ag-grid-community';
import { DEFAULT_DATA_HOLDER, DEFAULT_WORD_LEVEL, WordViewRow } from './Types';
import { Pagination } from '../../../main/services/WordViewService';
import { WordView } from '../../../common/types/wordView';
import { arrayChanged } from '../../../common/utils/Util';
import { subscribeWithSelector } from 'zustand/middleware';
import { AgGridReact } from 'ag-grid-react';

export type PageParam = {
    pageNum: number;
    pageSize: number;
    whereSql?: string;
    orderBySql?: string;
};

export type DataPageData<D, R> = {
    shouldDiff: boolean;
    ele: {
        current:AgGridReact<any> | null
    };
    pageParam: PageParam;
    resultPage: Pagination<D>;
    loading: boolean;
    mounted: boolean;
    dataSource: R[];
    cellSelection: CellRange[];
    readonly loadFunc: (pageParam: PageParam) => Promise<Pagination<D>>;
    readonly toDataSourceFunc: (data: D[], offset?: number) => R[];
    readonly submitFunc: (data: R[]) => Promise<void>;
    readonly addRowsToDs: (ds: R[], num: number) => R[];
    readonly keys: (keyof D)[];
};

export type DataPageDataHolder = {
    wordView: DataPageData<WordView, WordViewRow>;
    dataHolder: DataPageData<WordView, WordViewRow>;
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
    diff: (key: keyof DataPageDataHolder) => void;
    tryMount: (key: keyof DataPageDataHolder) => Promise<void>;
    unmount: (key: keyof DataPageDataHolder) => void;
    setCellSelection: (
        key: keyof DataPageDataHolder,
        ranges: CellRange[]
    ) => void;
    setRef: (
        key: keyof DataPageDataHolder,
        ele: AgGridReact<any> | null
    ) => void;
};

const useDataPage = create<DataPageState & DataPageAction>()(subscribeWithSelector((set, get) => ({
    data: {
        wordView: DEFAULT_WORD_LEVEL,
        dataHolder: DEFAULT_DATA_HOLDER,
    },
    setRef: (key: keyof DataPageDataHolder, ele: AgGridReact<any> | null) => {
        get().data[key].ele.current = ele;
    },
    setCellSelection: (key: keyof DataPageDataHolder, ranges: CellRange[]) => {
        set((state) => {
            const data = state.data[key];
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...data,
                        cellSelection: ranges,
                    },
                },
            };
        });
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
    diff: (key: keyof DataPageDataHolder) => {
        // set shouldDiff to true
        set((state) => {
            const data = state.data[key];
            return {
                data: {
                    ...state.data,
                    [key]: {
                        ...data,
                        shouldDiff: true,
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
})));

export default useDataPage;

const diff =(key: keyof DataPageDataHolder):boolean => {
    console.log('diff', key);
    const resultPage  = useDataPage.getState().data[key].resultPage;
    const originalData = useDataPage
        .getState()
        .data[key].toDataSourceFunc(resultPage.data, resultPage.offset);
    const originalMapping = new Map<number, WordViewRow>();
    originalData.forEach((item) => {
        originalMapping.set(item.fakeId ?? 0, item);
    });
    const dataSource = useDataPage.getState().data[key].dataSource;
    let change = false;
    for (const item of dataSource) {
        const tempMarkup = item.markup;
        const tempUpdateColumns = [...item.updateColumns];
        if (item.markup === 'delete' || item.markup === 'new-delete') {
            item.updateColumns = [];
            console.log('delete item', item);
            if (tempMarkup !== item.markup || arrayChanged(tempUpdateColumns, item.updateColumns)) {
                change = true;
            }
            continue;
        }
        const originalItem = originalMapping.get(item.fakeId ?? 0);
        if (originalItem === undefined) {
            item.markup = 'new';
            item.updateColumns = [];
            console.log('new item', item);
            if (tempMarkup !== item.markup || arrayChanged(tempUpdateColumns, item.updateColumns)) {
                change = true;
            }
            continue;
        }
        const keys = useDataPage.getState().data[key].keys;
        keys.forEach((key) => {
            if (item[key] !== originalItem?.[key]) {
                item.markup = 'update';
                if (!item.updateColumns.includes(key)) {
                    item.updateColumns.push(key);
                }
                console.log('update item', item);
            }
        });
        if (tempMarkup !== item.markup || arrayChanged(tempUpdateColumns, item.updateColumns)) {
            change = true;
        }
    }
    return change;
}

setInterval(() => {
    const keys: (keyof DataPageDataHolder)[] = ['wordView', 'dataHolder'];
    for (const key of keys) {
        if (useDataPage.getState().data[key].shouldDiff) {
            useDataPage.setState((state) => {
                const data = state.data[key];
                return {
                    data: {
                        ...state.data,
                        [key]: {
                            ...data,
                            shouldDiff: false,
                        },
                    },
                };
            });
            const change = diff(key);
            if (change) {
                useDataPage.getState().data[key].ele.current?.api?.refreshCells({
                    force: true,
                });
            }
        }
    }
}, 500);

