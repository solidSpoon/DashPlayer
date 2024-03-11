import * as React from 'react';

export interface MySliderProps {
    className?: string;
    sliderClassName?: string;
}
const MySlider = ({ className, sliderClassName, ...props }: MySliderProps) => (
    // <SliderPrimitive.Root
    //     className={cn(
    //         'relative flex w-full touch-none select-none items-center',
    //         className
    //     )}
    //     {...props}
    // >
    //     <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/50">
    //         <SliderPrimitive.Range className="absolute h-full bg-white/75" />
    //     </SliderPrimitive.Track>
    //     <SliderPrimitive.Thumb
    //         className={cn(
    //             'block h-4 w-4 rounded-full border border-primary/50 shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
    //             sliderClassName
    //         )}
    //     />
    // </SliderPrimitive.Root>
    <></>
);
// Slider.displayName = SliderPrimitive.Root.displayName;
MySlider.defaultProps = {
    className: '',
    sliderClassName: 'bg-background',
};
export { MySlider };
