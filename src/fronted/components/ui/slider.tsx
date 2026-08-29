import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/fronted/lib/utils"

export interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  trackClassName?: string;
  rangeClassName?: string;
  thumbClassName?: string;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, trackClassName, rangeClassName, thumbClassName, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "group relative flex w-full h-3 touch-none select-none items-center cursor-pointer",
      className
    )}
    {...props}
  >
    <div className="relative w-full h-1 flex items-center">
      <SliderPrimitive.Track className={cn("relative h-1 w-full grow overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/20 transition-all duration-150 group-hover:h-1.5", trackClassName)}>
        <SliderPrimitive.Range className={cn("absolute h-full bg-primary rounded-full", rangeClassName)} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className={cn("block h-3 w-3 rounded-full border-2 border-primary bg-background shadow-sm transition-all duration-150 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50", thumbClassName)} />
    </div>
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
