"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/fronted/lib/utils"
import { Button } from "@/fronted/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/fronted/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/fronted/components/ui/popover"
import { useTranslation } from 'react-i18next';

export interface ComboboxDemoProps {
    options: { value: string; label: string }[],
    value: string
    onSelect: (value: string) => void
}

export default function Combobox({ options, value, onSelect }: ComboboxDemoProps) {
    const [open, setOpen] = React.useState(false)
    const { t } = useTranslation('common');

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[200px] justify-between"
                >
                    {value
                        ? options.find((framework) => framework.value === value)?.label
                        : t('selectModel')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder={t('search')} />
                    <CommandList>
                        <CommandEmpty>{t('noResults')}</CommandEmpty>
                        <CommandGroup>
                            {options.map((framework) => (
                                <CommandItem
                                    key={framework.value}
                                    value={framework.value}
                                    onSelect={(currentValue) => {
                                        onSelect(currentValue === value ? "" : currentValue)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === framework.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {framework.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
