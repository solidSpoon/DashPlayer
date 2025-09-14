import React from 'react';
import { Button } from '@/fronted/components/ui/button';
import WithMarkdownTooltip from './WithMarkdownTooltip';
import { cn } from '@/fronted/lib/utils';

type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface TooltippedButtonProps extends Omit<React.ComponentProps<typeof Button>, 'children'> {
  text: React.ReactNode;
  icon?: IconType;
  iconClassName?: string;
  tooltipMd?: string;
  tooltipClassName?: string;
  fullWidth?: boolean;
}

export default function TooltippedButton({
  text,
  icon: Icon,
  iconClassName = 'mr-2 h-4 w-4',
  tooltipMd,
  tooltipClassName,
  fullWidth,
  className,
  variant = 'ghost',
  ...rest
}: TooltippedButtonProps) {
  return (
    <WithMarkdownTooltip md={tooltipMd} contentClassName={tooltipClassName}>
      <Button
        variant={variant}
        className={cn('justify-start', fullWidth && 'w-full', className)}
        {...rest}
      >
        {Icon && <Icon className={iconClassName} />}
        {text}
      </Button>
    </WithMarkdownTooltip>
  );
}