import React from 'react';
import usePlayerController from '../hooks/usePlayerController';

export default function UploadButton() {
    const changePopType = usePlayerController((s) => s.changePopType);
    return (
        <>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <div
                className="flex items-center justify-center bg-uploadButton/80 hover:bg-uploadButton/90 rounded-full w-12 h-12 drop-shadow-md fixed bottom-12 right-12 z-50 backdrop-blur-3xl"
                onClick={() => {
                    changePopType('control');
                }}
            >
                <svg
                    className="icon fill-gray-100 w-1/2 h-1/2"
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path d="M426.666667 426.666667H85.546667A85.418667 85.418667 0 0 0 0 512c0 47.445333 38.314667 85.333333 85.546667 85.333333H426.666667v341.12c0 47.274667 38.186667 85.546667 85.333333 85.546667 47.445333 0 85.333333-38.314667 85.333333-85.546667V597.333333h341.12A85.418667 85.418667 0 0 0 1024 512c0-47.445333-38.314667-85.333333-85.546667-85.333333H597.333333V85.546667A85.418667 85.418667 0 0 0 512 0c-47.445333 0-85.333333 38.314667-85.333333 85.546667V426.666667z" />
                </svg>
            </div>
        </>
    );
}
