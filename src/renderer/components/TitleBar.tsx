import { useEffect, useState } from 'react';
import callApi from '../lib/apis/ApiWrapper';

const TitleBar = () => {
    const onDoubleClick = async () => {
        const isMaximized = (await callApi('is-maximized', [])) as boolean;
        if (isMaximized) {
            await callApi('unmaximize', []);
        } else {
            await callApi('maximize', []);
        }
    };

    return (
        <div
            className="drag w-full h-10 absolute top-0 z-50"
            onDoubleClick={onDoubleClick}
        />
    );
};
export default TitleBar;
