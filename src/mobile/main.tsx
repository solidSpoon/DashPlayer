import React from 'react';
import { createRoot } from 'react-dom/client';
import MobileApp from './MobileApp';
import { applyTheme, readTheme } from './theme';
import './mobile.css';

applyTheme(readTheme());

const container = document.getElementById('root');
if (!container) {
    throw new Error('手机页缺少 #root 容器');
}

createRoot(container).render(<MobileApp />);
