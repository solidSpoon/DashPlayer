import { useEffect, useState } from 'react';
import callApi from '../lib/apis/ApiWrapper';
import TransFiller from '../lib/TransFiller';
import TitleBarWindows from './TitleBarWindows';
import TitleBarMac from './TitleBarMac';

export interface TitleBarProps {
    title: string | undefined;
    show: boolean;
}

const TitleBar = ({ title, show }: TitleBarProps) => {
    const [isWindows, setIsWindows] = useState<boolean>(false);

    console.log('isW ttttt')
    useEffect(() => {
        console.log('isw bbbbb')
        const fun = async () => {
          const isW = await callApi('is-windows',[]) as boolean;
          setIsWindows(isW);
          console.log('isw', isW)
        }
        fun();
    }, []);

    return(
        <>
            {isWindows ? <TitleBarWindows title={title}/> : <TitleBarMac title={title} show={show}/>}
        </>

    )
};
export default TitleBar;
