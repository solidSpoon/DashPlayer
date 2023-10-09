import React, { ReactElement, useEffect, useRef, useState } from 'react';
import FileT from '../lib/param/FileT';
import parseFile from '../lib/FileParser';
import UploadButton from './UploadButton';

export type FileDropParam = {
    children: ReactElement;
    onFileChange: (file: FileT) => void;
    className?: string | undefined;
    onDragIn?: () => void;
    onDragOut?: () => void;
};

const FileDrop = ({ children, onFileChange, className }: FileDropParam) => {
    // 创建组件引用
    const dropRef = useRef<HTMLDivElement>(null);
    const counter = useRef(0);
    const [isDragging, setIsDragging] = React.useState<boolean>(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

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
    }, [isDragging]);
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
            onFileChange(file);
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
            <UploadButton
                mousePosition={mousePosition}
                isDragging={isDragging}
                onFileChange={(file) => {
                    onFileChange(file);
                }}
            />
        </>
    );
};

FileDrop.defaultProps = {
    className: '',
    onDragIn: () => {},
    onDragOut: () => {},
};
export default FileDrop;
