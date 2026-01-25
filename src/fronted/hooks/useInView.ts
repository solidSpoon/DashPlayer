import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

type UseInViewOptions = IntersectionObserverInit | undefined;

const useInView = <T extends Element>(ref: RefObject<T>, options?: UseInViewOptions) => {
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
