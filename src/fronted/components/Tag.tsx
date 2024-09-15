// src/components/ui/Tag.tsx

import React from 'react';

interface TagProps {
    children: React.ReactNode;
    onContextMenu?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
    className?: string;
}

const Tag: React.FC<TagProps> = ({ children, onContextMenu, className }) => {
    return (
        <div
            onContextMenu={onContextMenu}
            className={`inline-flex items-center px-2 py-1 mr-2 mb-2 text-sm font-medium text-white bg-blue-600 rounded-full cursor-pointer hover:bg-blue-700 transition-colors ${className}`}
        >
            {children}
        </div>
    );
};

export default Tag;
