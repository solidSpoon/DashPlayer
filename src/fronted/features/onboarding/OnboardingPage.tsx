import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/fronted/components/ui/alert-dialog';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import type { AppearanceSettingVO } from '@/common/contracts/appearance-setting-vo';
import type { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import type { ServiceCredentialSettingDetailVO } from '@/common/types/vo/service-credentials-setting-vo';
import { onboardingApi } from './onboardingApi';
import type { OnboardingEngineChoice } from './types';
import WelcomeStep from './components/WelcomeStep';
import ModelsStep from './components/ModelsStep';
import EngineStep from './components/EngineStep';

/** 需要计步的步骤数量：欢迎、语音模型、引擎选择；最后的确认页不计入。 */
const STEP_COUNT = 3;

/**
 * 首次使用引导页。
 *
 * 三步流程：欢迎（语言/主题）→ 引擎选择（本地/云端）→ 完成页。
 * 跳过视为完成当前版本引导（写入版本标记），文案中说明以后可在设置里补配置；
 * 未点完成就关闭应用时不会写标记，下次启动会再次进入引导。
 */
const OnboardingPage = () => {
    const { t } = useTranslation('onboarding');
    const navigate = useNavigate();

    /** 当前页面索引；0 欢迎，1 语音模型，2 引擎，3 完成确认（不计步）。 */
    const [step, setStep] = React.useState(0);
    /** 引擎步骤的应用结果；决定完成页展示的摘要。 */
    const [appliedChoice, setAppliedChoice] = React.useState<OnboardingEngineChoice | null>(null);
    /** 完成请求进行中标记，防止重复点击。 */
    const [finishing, setFinishing] = React.useState(false);

    const { data: appearance } = useSWR<AppearanceSettingVO>(
        'settings/appearance/detail',
        () => settingsApi.getAppearance(),
    );
    const { data: engineDetail } = useSWR<EngineSelectionSettingVO>(
        'settings/engine-selection/detail',
        () => settingsApi.getEngineSelection(),
    );
    const { data: credentialDetail } = useSWR<ServiceCredentialSettingDetailVO>(
        'settings/service-credentials/detail',
        () => settingsApi.getServiceCredentials(),
    );

    /**
     * 写入引导完成标记并回到首页。
     *
     * 标记写入失败时停留在引导页并以 toast 显式报错，避免用户以为已完成。
     */
    const finish = async () => {
        if (finishing) {
            return;
        }
        setFinishing(true);
        try {
            await onboardingApi.complete();
            navigate('/home');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
            setFinishing(false);
        }
    };

    return (
        <div className="w-full h-full overflow-y-auto bg-background">
            <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-6 py-10">
                <div className="flex items-center justify-between">
                    {step < STEP_COUNT ? (
                        <span className="text-xs text-muted-foreground">
                            {t('stepEngineOf', { current: step + 1, total: STEP_COUNT })}
                        </span>
                    ) : (
                        <span />
                    )}
                    {step < STEP_COUNT && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                                    {t('skip')}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t('skipTitle')}</AlertDialogTitle>
                                    <AlertDialogDescription>{t('skipDescription')}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t('skipCancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => finish()}>
                                        {t('skipConfirm')}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>

                <div className="flex flex-1 flex-col justify-center py-8">
                    {step === 0 && <WelcomeStep appearance={appearance ?? null} />}
                    {step === 1 && <ModelsStep />}
                    {step === 2 && (
                        <EngineStep
                            engineDetail={engineDetail ?? null}
                            credentialDetail={credentialDetail ?? null}
                            onApplied={(choice) => {
                                setAppliedChoice(choice);
                                setStep(3);
                            }}
                        />
                    )}
                    {step === 3 && (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <CheckCircle2 className="h-14 w-14 text-primary" />
                            <h2 className="text-2xl font-bold">{t('done.title')}</h2>
                            {appliedChoice?.type === 'local' && (
                                <p className="text-sm text-muted-foreground">
                                    {t('done.localSummary', { model: appliedChoice.modelName })}
                                </p>
                            )}
                            {appliedChoice?.type === 'cloud' && (
                                <p className="text-sm text-muted-foreground">{t('done.cloudSummary')}</p>
                            )}
                            {!appliedChoice && (
                                <p className="text-sm text-muted-foreground">{t('done.skippedSummary')}</p>
                            )}
                            <p className="text-sm text-muted-foreground">{t('done.hint')}</p>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={step === 0}
                        onClick={() => setStep((current) => Math.max(0, current - 1))}
                    >
                        {t('back')}
                    </Button>
                    {step < STEP_COUNT ? (
                        <Button type="button" onClick={() => setStep((current) => current + 1)}>
                            {t('next')}
                        </Button>
                    ) : (
                        <Button type="button" disabled={finishing} onClick={() => finish()}>
                            {t('start')}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingPage;
