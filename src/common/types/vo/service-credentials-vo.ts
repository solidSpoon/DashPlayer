export type ServiceCredentialsVO = {
    openai: {
        apiKey: string;
        endpoint: string;
        model: string;
    };
    tencent: {
        secretId: string;
        secretKey: string;
    };
    youdao: {
        secretId: string;
        secretKey: string;
    };
    local: {
        whisper: {
            modelSize: 'base' | 'large';
            enableVad: boolean;
            vadModel: 'silero-v6.2.0';
        };
    };
};

