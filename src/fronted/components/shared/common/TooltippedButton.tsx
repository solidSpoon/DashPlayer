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
  /** 为 true 时在按钮右上角显示小圆点，用作不显眼的通知标记。 */
  dot?: boolean;
}

export default function TooltippedButton({
  text,
  icon: Icon,
  iconClassName = 'mr-2 h-4 w-4',
  tooltipMd,
  tooltipClassName,
  fullWidth,
  dot = false,
  className,
  variant = 'ghost',
  ...rest
}: TooltippedButtonProps) {
  return (
    <WithMarkdownTooltip md={tooltipMd} contentClassName={tooltipClassName}>
      <Button
        variant={variant}
        className={cn('relative justify-start', fullWidth && 'w-full', className)}
        {...rest}
      >
        {Icon && <Icon className={iconClassName} />}
        {Icon && dot && (
          <span
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
            aria-hidden
          />
        )}
        {text}
      </Button>
    </WithMarkdownTooltip>
  );
}