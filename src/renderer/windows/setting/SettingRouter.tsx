import { HashRouter, Route, Routes } from 'react-router-dom';
import HomePage from '../../components/HomePage';
import TieleBarLayout from '../player/pages/TieleBarLayout';
import { PlayerP, WordManagement } from '../player/pages';
import Layout from '../player/pages/Layout';
import React from 'react';
import SettingLayout from './SettingLayout';
import ShortcutSetting from './pages/ShortcutSetting';
import YouDaoSetting from './pages/YouDaoSetting';
import TenantSetting from './pages/TenantSetting';
import StorageSetting from './pages/StorageSetting';
import CheckUpdate from './pages/CheckUpdate';
import AppearanceSetting from './pages/AppearanceSetting';

export type SettingType =
    | 'you-dao'
    | 'tenant'
    | 'shortcut'
    | 'storage'
    | 'update'
    | 'appearance';
const SettingRouter = () => {
    return (
        <HashRouter>
            <Routes>
                <Route element={<SettingLayout />}>
                    <Route path='/' element={<ShortcutSetting />} />
                    <Route
                        path='shortcut'
                        element={<ShortcutSetting />}
                    />
                    <Route
                        path='you-dao'
                        element={<YouDaoSetting />} />
                    <Route
                        path='tenant'
                        element={<TenantSetting />} />
                    <Route
                        path='storage'
                        element={<StorageSetting />} />
                    <Route
                        path='update'
                        element={<CheckUpdate />} />
                    <Route
                        path='appearance'
                        element={<AppearanceSetting />} />
                </Route>
            </Routes>
        </HashRouter>
    );
};

export default SettingRouter;
