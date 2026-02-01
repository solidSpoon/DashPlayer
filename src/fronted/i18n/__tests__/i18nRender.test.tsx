import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '@/fronted/i18n/i18n';
import useI18n from '@/fronted/i18n/useI18n';

function Demo() {
    const { t } = useI18n();
    return <div>{t('nav.player')}</div>;
}

describe('i18n render', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('zh-CN');
    });

    it('updates text when language changes', async () => {
        const { rerender } = render(
            <I18nextProvider i18n={i18n}>
                <Demo />
            </I18nextProvider>
        );

        expect(screen.getByText('播放器')).toBeInTheDocument();

        await i18n.changeLanguage('en-US');
        rerender(
            <I18nextProvider i18n={i18n}>
                <Demo />
            </I18nextProvider>
        );

        expect(screen.getByText('Player')).toBeInTheDocument();
    });
});
