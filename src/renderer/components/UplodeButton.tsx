import React, { Component, Fragment } from 'react';
import style from './css/UplodeButtom.module.css';
import FileT, { FileType } from '../lib/param/FileT';
import UploadPhotoParam from '../lib/param/UploadPhotoParam';

export default class UploadPhoto extends Component<UploadPhotoParam, never> {
    private readonly fileInputEl: React.RefObject<HTMLInputElement>;

    constructor(props: UploadPhotoParam | Readonly<UploadPhotoParam>) {
        super(props);
        this.fileInputEl = React.createRef();
    }

    handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const files = [...event.target.files];
        if (files.length === 0) return;
        const { onFileChange } = this.props;
        files.forEach((file) => {
            const fileT = new FileT();
            fileT.fileName = file.name;
            fileT.objectUrl = this.getFileUrl(file);
            const isSrt = file.name.endsWith('srt');
            if (isSrt) {
                fileT.fileType = FileType.SUBTITLE;
            } else {
                fileT.fileType = FileType.VIDEO;
            }
            if (onFileChange) {
                onFileChange(fileT);
            }
        });
    };

    getFileUrl = (file: Blob | MediaSource): string => {
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

    render() {
        return (
            <>
                <input
                    type="file"
                    multiple
                    ref={this.fileInputEl} // 挂载ref
                    accept=".mp4,.mkv,.srt" // 限制文件类型
                    hidden // 隐藏input
                    onChange={(event) => this.handlePhoto(event)}
                />
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
                <a
                    className={style.button}
                    onClick={() => {
                        this.fileInputEl.current?.click(); // 当点击a标签的时候触发事件
                    }}
                >
                    <svg
                        className="icon"
                        viewBox="0 0 1024 1024"
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        p-id="5901"
                        width="200"
                        height="200"
                    >
                        <path
                            d="M426.666667 426.666667H85.546667A85.418667 85.418667 0 0 0 0 512c0 47.445333 38.314667 85.333333 85.546667 85.333333H426.666667v341.12c0 47.274667 38.186667 85.546667 85.333333 85.546667 47.445333 0 85.333333-38.314667 85.333333-85.546667V597.333333h341.12A85.418667 85.418667 0 0 0 1024 512c0-47.445333-38.314667-85.333333-85.546667-85.333333H597.333333V85.546667A85.418667 85.418667 0 0 0 512 0c-47.445333 0-85.333333 38.314667-85.333333 85.546667V426.666667z"
                            p-id="5902"
                        />
                    </svg>
                </a>
            </>
        );
    }
}
