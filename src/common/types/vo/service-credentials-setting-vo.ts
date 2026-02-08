export type ServiceCredentialSettingVO = {
    openai: {
        key: string;
        endpoint: string;
        models: string[];
    };
    tencent: {
        secretId: string;
        secretKey: string;
    };
    youdao: {
        secretId: string;
        secretKey: string;
    };
    whisper: {
        modelSize: 'base' | 'large';
        enableVad: boolean;
        vadModel: 'silero-v5.1.2' | 'silero-v6.2.0';
    };
};
