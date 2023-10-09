import React, { ReactElement, useRef, useState } from 'react';
import FileT from '../lib/param/FileT';
import parseFile from '../lib/FileParser';

export type FileDropParam = {
    children: ReactElement;
    onFileChange: (file: FileT) => void;
    className?: string | undefined;
};

const FileDrop = ({ children, onFileChange, className }: FileDropParam) => {
    // 创建组件引用
    const dropRef = useRef<HTMLDivElement>(null);

    const handleDragIn = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragOut = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
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
    };

    const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    return (
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
    );
};

FileDrop.defaultProps = {
    className: '',
};
export default FileDrop;
