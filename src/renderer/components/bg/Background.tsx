import './Bachground.css';
import { cn } from '../../../common/utils/Util';

const Background = ({ className }: { className?: string }) => {
    return <div className={cn('w-full h-full bg-bg-bg',
        className)} />;
};

Background.defaultProps = {
    className: '',
};

export default Background;
