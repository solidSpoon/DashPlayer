import { useEffect, useState } from 'react';
import callApi from '../lib/apis/ApiWrapper';
import TransFiller from '../lib/TransFiller';
import TitleBarWindows from './TitleBarWindows';
import TitleBarMac from './TitleBarMac';

export interface TitleBarProps {
    hasSubTitle: boolean;
    title: string | undefined;
    show: boolean;
}

const TitleBar = ({ hasSubTitle, title, show }: TitleBarProps) => {
    const [isWindows, setIsWindows] = useState<boolean>(false);

    useEffect(() => {
        const fun = async () => {
            const isW = (await callApi('is-windows', [])) as boolean;
            setIsWindows(isW);
            console.log('isw', isW);
        };
        fun();
    }, []);

    return (
        <>
            {isWindows ? (
                <TitleBarWindows hasSubtitle={hasSubTitle} title={title} />
            ) : (
                <TitleBarMac hasSubtitle={hasSubTitle} title={title} show={show} />
            )}
        </>
    );
};
export default TitleBar;
