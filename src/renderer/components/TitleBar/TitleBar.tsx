import TitleBarWindows from './TitleBarWindows';
import TitleBarMac from './TitleBarMac';
import useSystem from '../../hooks/useSystem';

export interface TitleBarProps {
    autoHideOnMac?: boolean;
    className?: string;
    maximizable?: boolean;
}

const TitleBar = ({ autoHideOnMac, className, maximizable }: TitleBarProps) => {
    const isWindows = useSystem((s) => s.isWindows);

    return (
        <>
            {isWindows ? (
                <TitleBarWindows
                    className={className}
                    maximizable={maximizable}
                />
            ) : (
                <TitleBarMac autoHide={autoHideOnMac} />
            )}
        </>
    );
};

TitleBar.defaultProps = {
    autoHideOnMac: true,
    className: '',
    maximizable: true,
};
export default TitleBar;
