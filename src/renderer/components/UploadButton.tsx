import React, { useRef } from 'react';
import UploadPhotoParam from '../lib/param/UploadPhotoParam';
import FileT, { FileType } from '../lib/param/FileT';

const getFileUrl = (file: Blob | MediaSource): string => {
    let url: string;

    if (window.URL !== undefined) {
        url = window.URL.createObjectURL(file);
    } else if (window.webkitURL !== undefined) {
        url = window.webkitURL.createObjectURL(file);
    } else {
        throw new Error('can not create object url');
    }
    return url;
};
export default function UploadButton({
    onFileChange,
    onSelectingFile,
}: UploadPhotoParam) {
    const fileInputEl = useRef<HTMLInputElement>(null);

    const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const files = [...event.target.files];
        if (files.length === 0) return;
        files.forEach((file) => {
            const fileT = new FileT();
            fileT.fileName = file.name;
            fileT.objectUrl = getFileUrl(file);
            const isSrt = file.name.endsWith('srt');
            if (isSrt) {
                fileT.fileType = FileType.SUBTITLE;
            } else {
                fileT.fileType = FileType.VIDEO;
            }
            onFileChange(fileT);
        });
    };

    return (
        <>
            <input
                type="file"
                multiple
                ref={fileInputEl} // 挂载ref
                accept=".mp4,.mkv,.srt,.webm" // 限制文件类型
                hidden // 隐藏input
                onChange={(event) => handleFile(event)}
            />
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <a
                className="flex items-center justify-center bg-lime-700/80 hover:bg-lime-700/90 rounded-full w-12 h-12 drop-shadow-md fixed bottom-12 right-12 z-50"
                onClick={() => {
                    fileInputEl.current?.click(); // 当点击a标签的时候触发事件
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
            </a>
        </>
    );
}
