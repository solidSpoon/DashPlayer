import FileT from './FileT';

interface UploadPhotoParam {
    onSelectingFile: (isSelect: boolean) => void;
    onFileChange: (file: FileT) => void;
}

export default UploadPhotoParam;
