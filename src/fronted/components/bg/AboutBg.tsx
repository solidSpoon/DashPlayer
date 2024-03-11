import { cn } from '../../../common/utils/Util';
import './AboutBg.css';

const AboutBg = ({ className }: { className?: string }) => {
    return <div className={cn('w-full h-full about-bg', className)} />;
};

AboutBg.defaultProps = {
    className: '',
};

export default AboutBg;
