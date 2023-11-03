import { TypeCellSelection } from '@inovua/reactdatagrid-community/types/TypeSelected';
import { WordLevel } from '../db/entity/WordLevel';

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
    private allData: WordLevel[];

    private columnOrder: string[];

    private elements: Element[][] = [];

    private ColumnIndexMapping = new Map<string, number>();

    private RowIndexMapping = new Map<number, number>();

    constructor(allData: WordLevel[], columnOrder: string[]) {
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
            this.RowIndexMapping.set(row.id ?? 0, index);
        });
    }

    public getValueAt(c: Coordinate) {
        return this.elements[c.rowIndex][c.columnIndex].value;
    }

    public getDataSource() {
        return this.allData;
    }

    public setValueAt(c: Coordinate, value: string) {
        const { rowIndex } = c;
        const columnId = this.columnOrder[c.columnIndex];
        const newElement = {
            ...this.allData[rowIndex],
            [columnId]: value,
        };
        this.allData = [
            ...this.allData.slice(0, rowIndex),
            newElement,
            ...this.allData.slice(rowIndex + 1),
        ];
        this.elements[rowIndex][c.columnIndex].value = value;
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

export const paste = (
    dataHolder: DataHolder,
    selects: SelectResult,
    cpInfo: CPInfo[]
) => {
    cpInfo.forEach((cp) => {
        dataHolder.setValueAt(
            addCoordinate(cp.coordinate, selects.baseIndex),
            cp.value ?? ''
        );
    });
};
