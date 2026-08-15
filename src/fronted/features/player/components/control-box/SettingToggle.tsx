import React from 'react';
import { Switch } from '@/fronted/components/ui/switch';
import { Label } from '@/fronted/components/ui/label';
import WithMarkdownTooltip from '@/fronted/components/shared/common/WithMarkdownTooltip';
import { cn } from '@/fronted/lib/utils';

interface SettingToggleProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  tooltipMd?: string;
  className?: string;
  labelClassName?: string;
}

export default function SettingToggle({
  id,
  label,
  checked,
  onCheckedChange,
  tooltipMd,
  className,
  labelClassName
}: SettingToggleProps) {
  const row = (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors',
        'bg-muted/45 hover:bg-muted/60',
        'shadow-[0_1px_2px_rgba(60,64,67,0.10)]',
        checked && 'bg-[#fff1e6] hover:bg-[#ffe9d8] dark:bg-[#4a3526] dark:hover:bg-[#5a4030]',
        className
      )}
    >
      <Label htmlFor={id} className={cn('text-sm font-medium leading-tight text-foreground', labelClassName)}>
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-[#f2994a] data-[state=unchecked]:bg-[#c4c7c5] dark:data-[state=unchecked]:bg-[#5f6368]"
      />
    </div>
  );

  return tooltipMd ? (
    <WithMarkdownTooltip md={tooltipMd}>{row}</WithMarkdownTooltip>
  ) : (
    row
  );
}
