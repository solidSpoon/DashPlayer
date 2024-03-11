import TitleBarWindows from './TitleBarWindows';
import TitleBarMac from './TitleBarMac';
import useSystem from '../../hooks/useSystem';

export interface TitleBarProps {
    className?: string;
    maximizable?: boolean;
}

const TitleBar = ({ className, maximizable }: TitleBarProps) => {
    const isWindows = useSystem((s) => s.isWindows);

    return (
        <>
            {isWindows ? (
                <TitleBarWindows
                    className={className}
                    maximizable={maximizable}
                />
            ) : (
                <TitleBarMac />
            )}
        </>
    );
};

TitleBar.defaultProps = {
    className: '',
    maximizable: true,
};
export default TitleBar;
