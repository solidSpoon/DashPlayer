import FileT, { FileType } from '../types/FileT';
import { isSrt, isMedia } from './MediaTypeUtil';

const api = window.electron;
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
            : `dp-local:///${path}`;
    fileT.fileType = fileType;

    console.log('fileT', fileT);
    return fileT;
};

export { pathToFile };
