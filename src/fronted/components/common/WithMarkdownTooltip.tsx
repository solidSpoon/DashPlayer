import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import Md from '@/fronted/pages/player/chat/markdown';

interface WithMarkdownTooltipProps {
  children: React.ReactElement;
  md?: string;
  contentClassName?: string;
  asChild?: boolean;
}

export default function WithMarkdownTooltip({
  children,
  md,
  contentClassName,
  asChild = true
}: WithMarkdownTooltipProps) {
  if (!md) return children;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
        <TooltipContent className={contentClassName || 'p-8 pb-6 rounded-md shadow-lg'}>
          <Md>{md}</Md>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
