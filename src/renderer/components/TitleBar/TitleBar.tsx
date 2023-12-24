import TitleBarWindows from './TitleBarWindows';
import TitleBarMac from './TitleBarMac';
import useSystem from '../../hooks/useSystem';

export interface TitleBarProps {
    title?: string | undefined;
    autoHideOnMac?: boolean;
    className?: string;
    maximizable?: boolean;
    windowsButtonClassName?: string;
}

const TitleBar = ({
    title,
    autoHideOnMac,
    className,
    windowsButtonClassName,
    maximizable,
}: TitleBarProps) => {
    const isWindows = useSystem((s) => s.isWindows);

    return (
        <>
            {isWindows ? (
                <TitleBarWindows
                    title={title}
                    buttonClassName={windowsButtonClassName}
                    className={className}
                    maximizable={maximizable}
                />
            ) : (
                <TitleBarMac
                    autoHide={autoHideOnMac}
                />
            )}
        </>
    );
};

TitleBar.defaultProps = {
    autoHideOnMac: true,
    className: '',
    windowsButtonClassName: '',
    windowsHasSettings: true,
    maximizable: true,
    title: '',
};
export default TitleBar;
