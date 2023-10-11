import TitleBarWindows from './TitleBarWindows';
import TitleBarMac from './TitleBarMac';
import useSystem from '../../hooks/useSystem';

export interface TitleBarProps {
    hasSubTitle?: boolean;
    title?: string | undefined;
    autoHideOnMac?: boolean;
    className?: string;
    maximizable?: boolean;
    windowsButtonClassName?: string;
    windowsHasSettings?: boolean;
}

const TitleBar = ({
    hasSubTitle,
    title,
    autoHideOnMac,
    className,
    windowsButtonClassName,
    maximizable,
    windowsHasSettings,
}: TitleBarProps) => {
    const isWindows = useSystem((s) => s.isWindows);

    return (
        <>
            {isWindows ? (
                <TitleBarWindows
                    hasSubtitle={hasSubTitle}
                    title={title}
                    buttonClassName={windowsButtonClassName}
                    className={className}
                    maximizable={maximizable}
                />
            ) : (
                <TitleBarMac
                    hasSubtitle={hasSubTitle}
                    title={title}
                    autoHide={autoHideOnMac}
                    className={className}
                />
            )}
        </>
    );
};

TitleBar.defaultProps = {
    autoHideOnMac: true,
    className: '',
    windowsButtonClassName: '',
    windowsHasSettings: false,
    maximizable: true,
    hasSubTitle: false,
    title: '',
};
export default TitleBar;
