import { cn } from '../../../utils/Util';
import FileSelector from './atom/FileSelector';

export interface FileSelectPartProps {
    className?: string;
    itemClassName?: string;
}
export const FileSelectPart = ({className, itemClassName}:FileSelectPartProps) => {
    return (
        <div className={cn('flex flex-col', className)}>
            <FileSelector className={itemClassName} />
            <FileSelector className={itemClassName} directory />
        </div>
    )
}
FileSelectPart.defaultProps = {
    className: '',
    itemClassName: '',
}
