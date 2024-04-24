import FileT, { FileType } from '../types/FileT';
import { isSrt, isMedia } from './MediaTypeUtil';

const api = window.electron;
const parseFile = (file: File): FileT => {
    const fileT = new FileT();
    fileT.fileName = file.name;
    fileT.path = file.path;
    fileT.objectUrl = URL.createObjectURL(file);
    const isaSrt = isSrt(file.name);
    if (isaSrt) {
        fileT.fileType = FileType.SUBTITLE;
    } else if (isMedia(file.path)) {
        fileT.fileType = FileType.VIDEO;
    } else {
        fileT.fileType = FileType.OTHER;
    }
    return fileT;
};

const pathToFile = async (path: string): Promise<FileT> => {
    const fileT = new FileT();
    const fileSeparator = path.lastIndexOf('/') > 0 ? '/' : '\\';
    fileT.fileName = path.substring(path.lastIndexOf(fileSeparator) + 1);
    fileT.path = path;
    let fileType = FileType.OTHER;
    if (isSrt(path)) {
        fileType = FileType.SUBTITLE;
    } else if (isMedia(path)) {
        fileType = FileType.VIDEO;
    }
    fileT.objectUrl =
        fileType === FileType.SUBTITLE
            ? (await api.openFile(path)) ?? ''
            : `dp:///${path}`;
    fileT.fileType = fileType;

    console.log('fileT', fileT);
    return fileT;
};

export { pathToFile };

export default parseFile;
