'use client';

import * as React from 'react';
import { format } from 'date-fns';
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
                        {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                    {format(dateRange.from, 'LLL dd, y')} -{' '}
                                    {format(dateRange.to, 'LLL dd, y')}
                                </>
                            ) : (
                                format(dateRange.from, 'LLL dd, y')
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
                        onSelect={onDateRangeChange}
                        numberOfMonths={2}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
};
export default DatePickerWithRange;
