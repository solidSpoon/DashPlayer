/**
 * 在元素首次进入视口后返回 true，适合做懒加载和延迟渲染触发。
 */
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

type UseInViewOptions = IntersectionObserverInit | undefined;

const useInView = (ref: RefObject<Element | null>, options?: UseInViewOptions) => {
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node || inView) {
            return;
        }

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setInView(true);
                observer.disconnect();
            }
        }, options);

        observer.observe(node);

        return () => observer.disconnect();
    }, [ref, options, inView]);

    return inView;
};

export default useInView;
