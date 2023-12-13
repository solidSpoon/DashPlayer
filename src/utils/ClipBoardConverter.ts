import { TypeCellSelection } from '@inovua/reactdatagrid-community/types/TypeSelected';
import { DEFAULT_WORD_LEVEL, MarkupType, WordViewRow } from '../renderer/hooks/useDataPage/Types';
import { WordView } from '../db/tables/wordView';

export interface Coordinate {
    rowIndex: number;
    columnIndex: number;
}

export interface CPInfo {
    coordinate: Coordinate;
    value?: string;
}

interface SelectResult {
    baseIndex: Coordinate;
    selects: Coordinate[];
}

interface Element {
    key: string;
    value: string;
}

const addCoordinate = (a: Coordinate, b: Coordinate) => {
    return {
        rowIndex: a.rowIndex + b.rowIndex,
        columnIndex: a.columnIndex + b.columnIndex,
    };
};

export class DataHolder {
    private allData: WordViewRow[];

    private columnOrder: string[];

    private elements: Element[][] = [];

    private ColumnIndexMapping = new Map<string, number>();

    private RowIndexMapping = new Map<number, number>();

    constructor(allData: WordViewRow[], columnOrder: string[]) {
        this.allData = allData;
        this.columnOrder = columnOrder;

        allData.forEach((row) => {
            const elements: Element[] = [];
            columnOrder.forEach((column) => {
                elements.push({
                    key: `${column}`,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    value: row[column],
                });
            });
            this.elements.push(elements);
        });

        columnOrder.forEach((column, index) => {
            this.ColumnIndexMapping.set(column, index);
        });
        allData.forEach((row, index) => {
            this.RowIndexMapping.set(row.fakeId ?? 0, index);
        });
    }

    public addRowsToDs(num: number): void {
        const newDs = DEFAULT_WORD_LEVEL.addRowsToDs(this.allData, num);
        this.allData = newDs;
        this.elements = [];
        this.RowIndexMapping = new Map<number, number>();
        newDs.forEach((row) => {
            const elements: Element[] = [];
            this.columnOrder.forEach((column) => {
                elements.push({
                    key: `${column}`,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    value: row[column],
                });
            });
            this.elements.push(elements);
        });
        newDs.forEach((row, index) => {
            this.RowIndexMapping.set(row.fakeId ?? 0, index);
        });
    }

    public getValueAt(c: Coordinate) {
        return this.elements[c.rowIndex][c.columnIndex].value;
    }

    public getDataSource() {
        return this.allData;
    }

    public setValueAt(c: Coordinate, value: string) {
        let markup: MarkupType = 'update';
        if (c.rowIndex > this.maxRowIndex()) {
            this.addRowsToDs(c.rowIndex - this.maxRowIndex());
            markup = 'new';
        }
        if (c.columnIndex > this.maxColumnIndex()) {
            return;
        }
        const { rowIndex } = c;
        const columnId = this.columnOrder[c.columnIndex];
        const newElement: WordViewRow = {
            ...this.allData[rowIndex],
            markup,
            [columnId]: value,
        };
        if (markup === 'update') {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const oldVal = this.allData[rowIndex][columnId];
            if (oldVal === value) {
                newElement.markup = 'default';
            } else {
                newElement.updateColumns.push(columnId as keyof WordView);
            }
        }
        this.allData = [
            ...this.allData.slice(0, rowIndex),
            newElement,
            ...this.allData.slice(rowIndex + 1),
        ];
        console.log('rowIndex', rowIndex, 'columnIndex', c.columnIndex);
        this.elements[rowIndex][c.columnIndex].value = value;
    }

    public maxRowIndex() {
        return this.allData.length - 1;
    }

    public maxColumnIndex() {
        return this.columnOrder.length - 1;
    }

    public getColumIndex(columnId: string) {
        return this.ColumnIndexMapping.get(columnId);
    }

    public getRowIndex(rowId: number) {
        return this.RowIndexMapping.get(rowId);
    }
}

export const convertSelect = (
    dataHolder: DataHolder,
    tableSelects: TypeCellSelection
): SelectResult | undefined => {
    const selects: Coordinate[] = [];
    const baseIndex: Coordinate = {
        rowIndex: Number.MAX_SAFE_INTEGER,
        columnIndex: Number.MAX_SAFE_INTEGER,
    };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    Object.keys(tableSelects).forEach((key) => {
        const split = key.split(',');
        const rowIndex = dataHolder.getRowIndex(parseInt(split[0], 10));
        const columnIndex = dataHolder.getColumIndex(split[1]);
        if (rowIndex !== undefined && columnIndex !== undefined) {
            selects.push({
                rowIndex,
                columnIndex,
            });
        }
    });
    if (selects.length === 0) {
        return undefined;
    }
    selects.forEach((s) => {
        if (
            s.rowIndex < baseIndex.rowIndex ||
            s.columnIndex < baseIndex.columnIndex
        ) {
            baseIndex.rowIndex = s.rowIndex;
            baseIndex.columnIndex = s.columnIndex;
        }
    });

    return {
        baseIndex,
        selects: selects.map((s) => {
            return {
                rowIndex: s.rowIndex - baseIndex.rowIndex,
                columnIndex: s.columnIndex - baseIndex.columnIndex,
            };
        }),
    };
};

export const copy = (
    dataHolder: DataHolder,
    selects: SelectResult
): CPInfo[] => {
    const result: CPInfo[] = [];
    selects.selects.forEach((s) => {
        result.push({
            coordinate: s,
            value: dataHolder.getValueAt(addCoordinate(s, selects.baseIndex)),
        });
    });
    return result;
};

function addRowIfNeed(
    cpInfo: CPInfo[],
    selects: SelectResult,
    dataHolder: DataHolder
) {
    let targetIndex = -1;
    cpInfo.forEach((cp) => {
        targetIndex = Math.max(
            targetIndex,
            addCoordinate(cp.coordinate, selects.baseIndex).rowIndex
        );
    });

    if (targetIndex > dataHolder.maxRowIndex()) {
        const addNum = targetIndex - dataHolder.maxRowIndex();
        dataHolder.addRowsToDs(addNum);
    }
    console.log('addddd', dataHolder.getDataSource());
}

function filterInvalidColumns(
    cpInfo: CPInfo[],
    selects: SelectResult,
    dataHolder: DataHolder
): CPInfo[] {
    // 过滤掉列大于当前表格列的数据
    const result: CPInfo[] = [];
    cpInfo.forEach((cp) => {
        if (
            addCoordinate(cp.coordinate, selects.baseIndex).columnIndex <=
            dataHolder.maxColumnIndex()
        ) {
            result.push(cp);
        }
    });
    return result;
}

export const paste = (
    dataHolder: DataHolder,
    selects: SelectResult,
    cpInfo: CPInfo[]
) => {
    // eslint-disable-next-line no-param-reassign
    // cpInfo = filterInvalidColumns(cpInfo, selects, dataHolder);
    // addRowIfNeed(cpInfo, selects, dataHolder);
    cpInfo.forEach((cp) => {
        dataHolder.setValueAt(
            addCoordinate(cp.coordinate, selects.baseIndex),
            cp.value ?? ''
        );
    });
};

export const toCpInfos = (s: string): CPInfo[] => {
    if (s.endsWith('\n')) {
        // eslint-disable-next-line no-param-reassign
        s = s.substring(0, s.length - 1);
    }
    const lines = s.split('\n');
    const result: CPInfo[] = [];
    lines.forEach((line, rowIndex) => {
        const cells = line.split('\t');
        cells.forEach((cell, columnIndex) => {
            result.push({
                coordinate: {
                    rowIndex,
                    columnIndex,
                },
                value: cell,
            });
        });
    });
    return result;
};

export const toCpString = (cpInfos: CPInfo[]): string => {
    const maxRowIndex = Math.max(
        ...cpInfos.map((cp) => cp.coordinate.rowIndex)
    );
    const maxColumnIndex = Math.max(
        ...cpInfos.map((cp) => cp.coordinate.columnIndex)
    );
    const result: string[][] = [];
    for (let i = 0; i <= maxRowIndex; i += 1) {
        const row: string[] = [];
        for (let j = 0; j <= maxColumnIndex; j += 1) {
            row.push('');
        }
        result.push(row);
    }
    cpInfos.forEach((cp) => {
        result[cp.coordinate.rowIndex][cp.coordinate.columnIndex] =
            cp.value ?? '';
    });
    return result.map((row) => row.join('\t')).join('\n');
};
