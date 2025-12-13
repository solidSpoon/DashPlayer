import TitleBarWindows from './TitleBarWindows';
import TitleBarMac from './TitleBarMac';
import useSystem from '../../hooks/useSystem';
import { useEffect } from 'react';

export interface TitleBarProps {
    className?: string;
    maximizable?: boolean;
}

const TitleBar = ({ className, maximizable }: TitleBarProps) => {
    const isWindows = useSystem((s) => s.isWindows);
    const isMac = useSystem((s) => s.isMac);

    useEffect(() => {
        const updateFocusClass = () => {
            if (document.hasFocus()) {
                document.body.classList.add('focus');
            } else {
                document.body.classList.remove('focus');
            }
        };

        updateFocusClass();
        window.addEventListener('focus', updateFocusClass);
        window.addEventListener('blur', updateFocusClass);
        return () => {
            window.removeEventListener('focus', updateFocusClass);
            window.removeEventListener('blur', updateFocusClass);
        };
    }, []);

    return (
        <>
            {isWindows ? (
                <TitleBarWindows
                    className={className}
                    maximizable={maximizable}
                />
            ) : isMac ? (
                <TitleBarMac />
            ) : (
                <TitleBarWindows
                    className={className}
                    maximizable={maximizable}
                />
            )}
        </>
    );
};

TitleBar.defaultProps = {
    className: '',
    maximizable: true,
};
export default TitleBar;
