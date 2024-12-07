'use client';

import * as React from 'react';
import { format, endOfDay } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/fronted/components/ui/popover';
import { Calendar } from '@/fronted/components/ui/calendar';
import { Button } from '@/fronted/components/ui/button';
import { cn } from '@/fronted/lib/utils';

const DatePickerWithRange = ({
                                 className,
                                 dateRange,
                                 onDateRangeChange
                             }: {
    className?: string;
    dateRange?: DateRange;
    onDateRangeChange?: (dateRange: DateRange) => void;
}) => {
    const dateEmpty: boolean = !dateRange || (!dateRange.from && !dateRange.to);

    console.log('dateRange', dateRange);

    const formatDateRange = (range: DateRange | undefined) => {
        if (!range) return { from: undefined, to: undefined };
        return {
            from: range.from,
            to: range.to ? endOfDay(range.to) : undefined
        };
    };

    const handleDateRangeChange = (newDateRange: DateRange | undefined) => {
        if (onDateRangeChange) {
            onDateRangeChange(formatDateRange(newDateRange));
        }
    };

    const displayDateRange = formatDateRange(dateRange);

    return (
        <div className={cn('grid gap-2', className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={'outline'}
                        className={cn(
                            'w-[300px] justify-start text-left font-normal',
                            dateEmpty && 'text-muted-foreground'
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {displayDateRange.from ? (
                            displayDateRange.to ? (
                                <>
                                    {format(displayDateRange.from, 'LLL dd, y')} -{' '}
                                    {format(displayDateRange.to, 'LLL dd, y')}
                                </>
                            ) : (
                                format(displayDateRange.from, 'LLL dd, y')
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={handleDateRangeChange}
                        numberOfMonths={2}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
};

export default DatePickerWithRange;
