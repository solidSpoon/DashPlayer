import React from 'react';
import { BookOpen, Captions, Download, Rotate3D, Settings, SquareSplitHorizontal, Star, User, Video } from 'lucide-react';

export interface NavItem {
    id: string;
    label: string;
    path: string;
    icon?: React.ReactNode;
    homeOnly?: boolean;
    sidebarOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
    {
        id: 'pa-player',
        label: 'playbackLab',
        path: '/player', // Path usually needs videoId suffix
        icon: <Video />,
        sidebarOnly: true,
    },
    {
        id: 'favorite',
        label: 'savedMoments',
        path: '/favorite',
        icon: <Star />,
    },
    {
        id: 'transcript',
        label: 'subtitleWorkspace',
        path: '/transcript',
        icon: <Captions />,
    },
    {
        id: 'split',
        label: 'sentenceSplitter',
        path: '/split',
        icon: <SquareSplitHorizontal />,
    },
    {
        id: 'convert',
        label: 'formatConverter',
        path: '/convert',
        icon: <Rotate3D />,
    },
    {
        id: 'download',
        label: 'videoDownload',
        path: '/download',
        icon: <Download />,
    },
    {
        id: 'vocabulary',
        label: 'vocabularyStudio',
        path: '/vocabulary',
        icon: <BookOpen />,
    },
    {
        id: 'settings',
        label: 'settingsCenter',
        path: '/settings',
        icon: <Settings />,
    },
    {
        id: 'about',
        label: 'productStory',
        path: '/about',
        icon: <User />,
    },
];
