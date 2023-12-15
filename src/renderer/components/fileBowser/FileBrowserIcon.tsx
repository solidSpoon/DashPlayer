import { GoFile } from 'react-icons/go';
import { cn } from '../../../utils/Util';
import React from 'react';
import { VscFolder } from 'react-icons/vsc';
const baseClass = 'w-4 h-4 fill-yellow-700/90';
export class FileBrowserIcon {
    public static video = <GoFile className={cn(baseClass)} />;
    public static folder = <VscFolder className={cn(baseClass)} />;
    public static videoPlaying = <GoFile className={cn(baseClass)} />;
    public static folderPlaying = <VscFolder className={cn(baseClass)} />;
    public static videoWatched = <GoFile className={cn(baseClass, 'fill-gray-400')} />;
    public static folderWatched = <VscFolder className={cn(baseClass, 'fill-gray-400')} />;
    public static none = <></>;

}
