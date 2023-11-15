import {
    PiArrowFatUp,
    PiArrowLeft,
    PiArrowLineLeft,
    PiArrowLineRight,
    PiArrowRight,
    PiArrowsCounterClockwiseLight,
    PiArrowUUpLeft,
    PiDownload,
    PiDownloadSimple,
    PiExport,
    PiMinus,
    PiPlus,
} from 'react-icons/pi';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '../../../utils/Util';
import Separator from '../Separtor';
import useDataPage, {
    DataPageDataHolder,
} from '../../hooks/useDataPage/useDataPage';
import { convertSelect, DataHolder } from '../../../utils/ClipBoardConverter';

export interface WordLevelHeaderProps {
    keyName: keyof DataPageDataHolder;
}
const WordLevelHeader = ({ keyName }: WordLevelHeaderProps) => {
    const {
        page,
        submit,
        load,
        updatePageParam,
        pageParam,
        addBlankRow,
        cellSelection,
        dataSource,
        setDataSource,
        columOrder,
    } = useDataPage(
        useShallow((s) => ({
            page: s.data.wordLevel.resultPage,
            submit: s.submit,
            load: s.load,
            updatePageParam: s.updatePageParam,
            pageParam: s.data.wordLevel.pageParam,
            addBlankRow: s.addBlankRow,
            cellSelection: s.data.wordLevel.cellSelection,
            dataSource: s.data.wordLevel.dataSource,
            setDataSource: s.setDataSource,
            columOrder: s.data.wordLevel.columOrder,
        }))
    );
    const buttonClass = 'cursor-default hover:bg-gray-200 rounded p-1 h-6 w-6';

    const handleNextPage = async () => {
        updatePageParam(
            keyName,
            'pageNum',
            pageParam.pageNum + 1 > page.lastPage
                ? pageParam.pageNum
                : pageParam.pageNum + 1
        );
        await load(keyName);
    };

    const handlePrevPage = async () => {
        updatePageParam(
            keyName,
            'pageNum',
            pageParam.pageNum - 1 < 1 ? 1 : pageParam.pageNum - 1
        );
        await load(keyName);
    };
    const handleFirstPage = async () => {
        updatePageParam(keyName, 'pageNum', 1);
        await load(keyName);
    };

    const handleLastPage = async () => {
        updatePageParam(keyName, 'pageNum', page.lastPage);
        await load(keyName);
    };

    const handleDeleteRow = () => {
        const dataHolder = new DataHolder(dataSource, columOrder);
        const selectResult = convertSelect(dataHolder, cellSelection);

        if (selectResult) {
            const ds = [...dataSource];
            const baseIndex = selectResult.baseIndex.rowIndex;
            selectResult.selects
                .map((e) => e.rowIndex)
                .forEach((index) => {
                    ds[baseIndex + index] = {
                        ...ds[baseIndex + index],
                        markup: 'delete',
                    };
                });
            setDataSource(keyName, ds);
        }
    };

    return (
        <div
            className={cn(
                'flex flex-row items-center justify-between h-9 px-2 select-none'
            )}
        >
            <div
                className={cn(
                    'flex flex-row items-center justify-start gap-1 h-10 px-2'
                )}
            >
                <PiArrowLineLeft
                    onClick={handleFirstPage}
                    className={cn(buttonClass)}
                />
                <PiArrowLeft
                    onClick={handlePrevPage}
                    className={cn(buttonClass)}
                />
                <div
                    className={cn(
                        'flex items-center justify-center text-xs gap-1'
                    )}
                >
                    <span>
                        {page?.from} - {page?.to}{' '}
                    </span>
                    <span className={cn('text-gray-500')}>/</span>
                    <span>{page?.total}</span>
                </div>
                <PiArrowRight
                    onClick={handleNextPage}
                    className={cn(buttonClass)}
                />
                <PiArrowLineRight
                    onClick={handleLastPage}
                    className={cn(buttonClass)}
                />
                <Separator orientation="vertical" />
                <PiArrowsCounterClockwiseLight
                    onClick={async () => {
                        await load(keyName);
                    }}
                    className={cn(buttonClass)}
                />
                <Separator orientation="vertical" />
                <PiPlus
                    onClick={() => {
                        addBlankRow(keyName);
                    }}
                    className={cn(buttonClass)}
                />
                <PiMinus
                    onClick={handleDeleteRow}
                    className={cn(buttonClass)}
                />
                <PiArrowUUpLeft className={cn(buttonClass)} />
                <PiArrowFatUp
                    onClick={async () => {
                        await submit(keyName);
                    }}
                    className={cn(buttonClass, 'fill-green-600')}
                />
            </div>
            <div
                className={cn(
                    'flex flex-row items-center justify-end gap-1 h-10 px-2'
                )}
            >
                <PiDownload className={cn(buttonClass)} />
                <Separator orientation="vertical" />
                <PiDownloadSimple className={cn(buttonClass)} />
                <PiExport className={cn(buttonClass)} />
            </div>
        </div>
    );
};

export default WordLevelHeader;
