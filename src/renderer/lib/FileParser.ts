import FileT, { FileType } from './param/FileT';

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

const parseFile = (file: File): FileT => {
    const fileT = new FileT();
    fileT.fileName = file.name;
    fileT.objectUrl = getFileUrl(file);
    const isSrt = file.name.endsWith('srt');
    if (isSrt) {
        fileT.fileType = FileType.SUBTITLE;
    } else {
        fileT.fileType = FileType.VIDEO;
    }
    return fileT;
};

export default parseFile;
