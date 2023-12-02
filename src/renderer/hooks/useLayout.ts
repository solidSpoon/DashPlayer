import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import FileT, { FileType } from '../lib/param/FileT';
import WatchProjectItem from '../components/WatchProjectItem';
import { pathToFile } from '../lib/FileParser';
import { WatchProjectVideo } from '../../db/entity/WatchProjectVideo';
import usePlayerController from './usePlayerController';

type UseLayoutState = {
    showSideBar: boolean;
};

type UseLayoutActions = {
    changeSideBar: (show: boolean) => void;
};

const useLayout = create(
    subscribeWithSelector<UseLayoutState & UseLayoutActions>((set) => ({
        showSideBar: false,
        changeSideBar: (show: boolean) => {
            set({ showSideBar: show });
        },
    }))
);

export default useLayout;
