import FileT from './FileT';

interface UploadPhotoParam {
    onFileChange: (file: FileT) => void;
    isDragging: boolean;
    mousePosition: {
        x: number;
        y: number;
    };
}

export default UploadPhotoParam;
