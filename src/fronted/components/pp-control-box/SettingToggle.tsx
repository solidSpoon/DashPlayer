import React from 'react';
import { Switch } from '@/fronted/components/ui/switch';
import { Label } from '@/fronted/components/ui/label';
import WithMarkdownTooltip from '@/fronted/components/common/WithMarkdownTooltip';

interface SettingToggleProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  tooltipMd?: string;
}

export default function SettingToggle({
  id,
  label,
  checked,
  onCheckedChange,
  tooltipMd
}: SettingToggleProps) {
  const row = (
    <div className="flex items-center space-x-2">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );

  return tooltipMd ? (
    <WithMarkdownTooltip md={tooltipMd}>{row}</WithMarkdownTooltip>
  ) : (
    row
  );
}