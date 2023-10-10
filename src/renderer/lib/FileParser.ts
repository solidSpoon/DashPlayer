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
    // ".mp4,.mkv,.srt,.webm"
    const isSrt = file.name.endsWith('srt');
    const isVideo =
        file.type.endsWith('mp4') ||
        file.type.endsWith('webm') ||
        file.type.endsWith('mkv');
    if (isSrt) {
        fileT.fileType = FileType.SUBTITLE;
    } else if (isVideo) {
        fileT.fileType = FileType.VIDEO;
    } else {
        fileT.fileType = FileType.OTHER;
    }
    return fileT;
};

export default parseFile;
