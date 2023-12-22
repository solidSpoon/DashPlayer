import {
    PiAddressBook,
    PiArrowFatUp,
    PiArrowLeft,
    PiArrowLineLeft,
    PiArrowLineRight,
    PiArrowRight,
    PiArrowsCounterClockwiseLight, PiArrowUpLeft,
    PiArrowUUpLeft,
    PiDownload,
    PiDownloadSimple,
    PiExport,
    PiMinus,
    PiPlus
} from 'react-icons/pi';
import { useShallow } from 'zustand/react/shallow';
import { useState } from 'react';
import {
    useClick,
    useDismiss,
    useFloating,
    useInteractions
} from '@floating-ui/react';
import { cn } from '../../common/utils/Util';
import Separator from './Separtor';
import useDataPage, {
    DataPageDataHolder
} from '../hooks/useDataPage/useDataPage';
import { convertSelect, DataHolder } from '../../common/utils/ClipBoardConverter';
import IconButton from './toolTip/IconButton';

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
        ele
    } = useDataPage(
        useShallow((s) => ({
            page: s.data.wordView.resultPage,
            submit: s.submit,
            load: s.load,
            updatePageParam: s.updatePageParam,
            pageParam: s.data.wordView.pageParam,
            addBlankRow: s.addBlankRow,
            cellSelection: s.data.wordView.cellSelection,
            dataSource: s.data.wordView.dataSource,
            setDataSource: s.setDataSource,
            ele: s.data[keyName].ele
        }))
    );
    const buttonClass = 'cursor-default hover:bg-gray-200 rounded p-1 h-6 w-6';
    const [pageSelectOpen, setPageSelectOpen] = useState(false);
    const { refs, floatingStyles, context } = useFloating({
        open: pageSelectOpen,
        onOpenChange: setPageSelectOpen
    });

    const click = useClick(context);
    const dismiss = useDismiss(context);

    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        dismiss
    ]);
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
        console.log('cellSelection', cellSelection);
        const rows: number[] = [];
        cellSelection.forEach((row) => {
            for (
                let i = row.startRow?.rowIndex ?? 0;
                i <= (row.endRow?.rowIndex ?? 0);
                i++
            ) {
                rows.push(i);
            }
        });
        const deleted = dataSource.filter((_, index) => rows.includes(index));
        deleted.forEach((row, index) => {
            if (row.markup === 'new' || row.markup === 'new-delete') {
                row.markup = 'new-delete';
            } else {
                row.markup = 'delete';
            }
        });
        if (rows.length > 0) {
            console.log('newDataSource', ele.current);
            ele.current?.api?.redrawRows();
        }
    };

    const pageSelectItem = (num: number) => {
        return (
            <div
                onClick={() => {
                    updatePageParam(keyName, 'pageSize', num);
                    setPageSelectOpen(false);
                    updatePageParam(keyName, 'pageNum', 1);
                    load(keyName);
                }}
                className={cn(
                    'flex flex-row w-full items-center justify-start px-2 py-1 rounded hover:bg-stone-300 text-sm',
                    'cursor-pointer'
                )}
            >
                {num}
            </div>
        );
    };
    return (
        <>
            <div
                className={cn(
                    'flex flex-row items-center justify-between h-9 px-2 select-none bg-stone-100 border-t-[0.5px] border-b-[0.5px] border-stone-300'
                )}
            >
                <div
                    className={cn(
                        'flex flex-row items-center justify-start gap-1 h-10 px-2'
                    )}
                >
                    <IconButton onClick={handleFirstPage} icon={<PiArrowLineLeft />} tooltip={'首页'}
                                className={cn(buttonClass)} />
                    <IconButton onClick={handlePrevPage} icon={<PiArrowLeft />} tooltip={'上一页'}
                                className={cn(buttonClass)} />
                    <div
                        ref={refs.setReference}
                        className={cn(
                            'flex items-center justify-center text-xs gap-1',
                            'cursor-default hover:bg-gray-200 rounded p-1 h-6'
                        )}
                        {...getReferenceProps()}
                    >
                        <span>
                            {page?.from} - {page?.to}{' '}
                        </span>
                        <span className={cn('text-gray-500')}>/</span>
                        <span>{page?.total}</span>
                    </div>
                    <IconButton onClick={handleNextPage} icon={<PiArrowRight />} tooltip={'下一页'}
                                className={cn(buttonClass)} />
                    <IconButton onClick={handleLastPage} icon={<PiArrowLineRight />} tooltip={'尾页'}
                                className={cn(buttonClass)} />
                    <Separator orientation='vertical' />
                    {/*<PiArrowsCounterClockwiseLight*/}
                    {/*    onClick={async () => {*/}
                    {/*        await load(keyName);*/}
                    {/*    }}*/}
                    {/*    className={cn(buttonClass)}*/}
                    {/*/>*/}
                    <IconButton
                        onClick={async () => {
                            await load(keyName);
                        }}
                        icon={<PiArrowsCounterClockwiseLight />} tooltip={'刷新'} className={cn(buttonClass)} />
                    <Separator orientation='vertical' />
                    <IconButton
                        icon={<PiPlus />}
                        tooltip={'添加'}
                        onClick={() => {
                            addBlankRow(keyName);
                            ele.current?.api?.ensureIndexVisible(
                                dataSource.length - 2,
                                'middle'
                            );
                            setTimeout(() => {
                                ele.current?.api?.ensureIndexVisible(
                                    dataSource.length - 1,
                                    'middle'
                                );
                            }, 500);
                        }}
                        className={cn(buttonClass)}
                    />
                    <IconButton
                        icon={<PiMinus />}
                        tooltip={'删除'}
                        onClick={handleDeleteRow}
                        className={cn(buttonClass)}
                    />
                    <IconButton
                        icon={<PiArrowUUpLeft />}
                        tooltip={'回退'}
                        onClick={() => {
                        }}
                        className={cn(buttonClass)}
                    />
                    <IconButton
                        icon={<PiArrowFatUp />}
                        tooltip={'提交'}
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
                    <IconButton onClick={() => {
                    }} icon={<PiDownload />} tooltip={'TOTO'} className={cn(buttonClass)} />
                    <Separator orientation='vertical' />
                    <IconButton onClick={() => {
                    }} icon={<PiDownloadSimple />} tooltip={'TOTO'} className={cn(buttonClass)} />
                    <IconButton onClick={() => {
                    }} icon={<PiExport />} tooltip={'TOTO'} className={cn(buttonClass)} />
                </div>
            </div>
            {pageSelectOpen && (
                <div
                    ref={refs.setFloating}
                    style={floatingStyles}
                    className={cn(
                        'z-50 w-24 bg-stone-200 border-stone-500 border-[0.5px] rounded flex flex-col p-2'
                    )}
                >
                    {pageSelectItem(10)}
                    {pageSelectItem(100)}
                    {pageSelectItem(250)}
                    {pageSelectItem(500)}
                    {pageSelectItem(1000)}
                </div>
            )}
        </>
    );
};

export default WordLevelHeader;
