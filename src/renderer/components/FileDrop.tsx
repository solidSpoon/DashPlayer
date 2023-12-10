import React, { ReactElement, useEffect, useRef, useState } from 'react';
import parseFile from '../lib/FileParser';
import useFile from '../hooks/useFile';

export type FileDropParam = {
    children: ReactElement;
    className?: string | undefined;
    isDragging: boolean;
    setIsDragging: (dragging: boolean) => void;
};

const FileDrop = ({
    children,
    className,
    isDragging,
    setIsDragging,
}: FileDropParam) => {
    // 创建组件引用
    const dropRef = useRef<HTMLDivElement>(null);
    const counter = useRef(0);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const updateFile = useFile((s) => s.updateFile);

    useEffect(() => {
        let canceled = false;
        const callback = () => {
            if (canceled) {
                return;
            }
            setIsDragging(false);
            counter.current = 0;
            canceled = true;
        };
        if (isDragging) {
            window.addEventListener('mousemove', callback);
        }
        return () => {
            window.removeEventListener('mousemove', callback);
        };
    }, [isDragging, setIsDragging]);
    const handleDragIn = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(counter.current);
        if (counter.current === 0) {
            setIsDragging(true);
            console.log('drag in');
        }
        counter.current += 1;
    };

    const handleDragOut = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        counter.current -= 1;
        if (counter.current < 0) {
            counter.current = 0;
        }
        if (counter.current === 0) {
            setIsDragging(false);
            console.log('drag out');
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) {
            return;
        }
        const files = e.dataTransfer.files ?? [];
        for (let i = 0; i < files.length; i += 1) {
            const file = parseFile(files[i]);
            updateFile(file);
        }
        e.dataTransfer.clearData();
        counter.current = 0;
        setIsDragging(false);
    };

    const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('position', e.clientX, e.clientY);
        setMousePosition({ x: e.clientX, y: e.clientY });
    };

    return (
        <>
            <div
                // ref 引用
                ref={dropRef}
                className={className}
                onDragEnter={handleDragIn}
                onDragLeave={handleDragOut}
                onDrop={handleDrop}
                onDragOver={handleDrag}
            >
                {children}
            </div>
            {isDragging && (
                <div
                    className={`pointer-events-none flex z-50 items-center justify-center bg-lime-700 rounded-full w-56 h-56 drop-shadow-md blur-3xl
                        fixed left-0 top-0`}
                    style={{
                        transform: `translate(${mousePosition.x - 112}px, ${
                            mousePosition.y - 112
                        }px)`,
                    }}
                />
            )}
        </>
    );
};

FileDrop.defaultProps = {
    className: '',
};
export default FileDrop;
