import FileT, { FileType } from '../types/FileT';
import { isSubtitle, isVideo } from './MediaTypeUitl';

const api = window.electron;
const parseFile = (file: File): FileT => {
    const fileT = new FileT();
    fileT.fileName = file.name;
    fileT.path = file.path;
    fileT.objectUrl = URL.createObjectURL(file);
    const isSrt = isSubtitle(file.name);
    if (isSrt) {
        fileT.fileType = FileType.SUBTITLE;
    } else if (isVideo(file.path)) {
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
    if (isSubtitle(path)) {
        fileType = FileType.SUBTITLE;
    } else if (isVideo(path)) {
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
