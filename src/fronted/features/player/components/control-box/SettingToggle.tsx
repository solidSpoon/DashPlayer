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
        'group flex items-center justify-between gap-3 rounded-xl border px-3 py-1.5 transition-all duration-150',
        'border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border',
        checked && 'border-border/80 bg-accent/50',
        className
      )}
    >
      <Label
        htmlFor={id}
        className={cn(
          'text-xs cursor-pointer select-none leading-none transition-colors font-medium',
          checked ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
          labelClassName
        )}
      >
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="scale-[0.82] origin-right"
      />
    </div>
  );

  return tooltipMd ? (
    <WithMarkdownTooltip md={tooltipMd}>{row}</WithMarkdownTooltip>
  ) : (
    row
  );
}
