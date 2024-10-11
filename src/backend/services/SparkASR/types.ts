// types.ts

export interface UploadRequest {
    /** 音频文件名称，最好携带音频真实的后缀名，避免影响转码 */
    fileName: string;

    /** 音频文件大小（字节数），当前只针对本地文件流方式校验，使用url外链方式不校验，可随机传一个数字 */
    fileSize: number;

    /** 音频真实时长. 当前未验证，可随机传一个数字 */
    duration: number;

    /** 语种类型：默认 cn */
    language?:
        | "cn"
        | "en"
        | "ja"
        | "ko"
        | "ru"
        | "fr"
        | "es"
        | "vi"
        | "ar"
        | "cn_xinanese"
        | "cn_cantonese"
        | "cn_henanese"
        | "cn_uyghur"
        | "cn_tibetan"
        | "de"
        | "it";

    /** 回调地址，订单完成时回调该地址通知完成支持get 请求 */
    callbackUrl?: string;

    /** 热词，用以提升专业词汇的识别率，格式：热词1| 热词2| 热词3 */
    hotWord?: string;

    /** 多候选开关，0：关闭 (默认)，1：打开 */
    candidate?: 0 | 1;

    /** 是否开启角色分离，0：不开启角色分离(默认)，1：通用角色分离 */
    roleType?: 0 | 1;

    /** 说话人数，取值范围 0-10，默认为 0 进行盲分 */
    roleNum?: number;

    /** 领域个性化参数 */
    pd?:
        | "court"
        | "edu"
        | "finance"
        | "medical"
        | "tech"
        | "culture"
        | "isp"
        | "sport"
        | "gov"
        | "game"
        | "ecom"
        | "mil"
        | "com"
        | "life"
        | "ent"
        | "car";

    /** 转写音频上传方式，fileStream：文件流 (默认)，urlLink：音频url外链 */
    audioMode?: "fileStream" | "urlLink";

    /** 音频url外链地址，当audioMode为urlLink时该值必传 */
    audioUrl?: string;

    /** 是否标准pcm/wav(16k/16bit/单声道)，0：非标准 wav (默认)，1：标准pcm/wav */
    standardWav?: 0 | 1;

    /** 语言识别模式选择，支持的语言识别模式选择 */
    languageType?: 1 | 2 | 4;

    /** 按声道分轨转写模式 */
    trackMode?: 1 | 2;

    /** 需要翻译的语种(转写语种和翻译语种不能相同) */
    transLanguage?: string;

    /** 翻译模式（默认 2：按段落进行翻译） */
    transMode?: 1 | 2 | 3;

    /** 控制分段的最大字数，取值范围[0-500] */
    eng_seg_max?: number;

    /** 控制分段的最小字数，取值范围[0-50] */
    eng_seg_min?: number;

    /** 控制分段字数的权重，取值（0-0.05） */
    eng_seg_weight?: number;

    /** 顺滑开关，true：表示开启 (默认) */
    eng_smoothproc?: boolean;

    /** 口语规整开关，true：表示开启 */
    eng_colloqproc?: boolean;

    /** 远近场模式，1：远场模式 (默认)，2：近场模式 */
    eng_vad_mdn?: 1 | 2;

    /** 首尾是否带静音信息，0：不显示，1：显示 (默认) */
    eng_vad_margin?: 0 | 1;

    /** 针对粤语转写后的字体转换，0：输出简体，1：输出繁体 (默认) */
    eng_rlang?: 0 | 1;
}

export interface UploadResponse {
    /** 返回码，"000000"表示成功 */
    code: string;

    /** 描述信息，表示请求处理结果 */
    descInfo: string;

    /** 返回的内容 */
    content: {
        /** 订单号 */
        orderId: string;

        /** 任务预计完成时间（毫秒） */
        taskEstimateTime: number;
    };
}
/**
 * 查询结果类型
 */
type ResultType =
    | "transfer" // 转写结果
    | "translate" // 翻译结果
    | "predict"; // 质检结果

/**
 * 任务查询接口参数
 */
export interface GetResultRequest {
    orderId: string;
    /**
     * 查询结果类型
     * 默认返回转写结果
     * 可选值：
     * - "transfer": 转写结果
     * - "translate": 翻译结果
     * - "predict": 质检结果
     * 组合结果查询：多个类型结果使用”,”隔开，
     * 目前只支持转写和质检结果一起返回，
     * 不支持转写和翻译结果一起返回。
     * 如果任务有失败则只返回处理成功的结果。
     */
    resultType?: ResultType | `${ResultType},${ResultType}`; // 支持组合结果
}

 

/**
 * 内容接口
 */
interface Content {
    /**
     * 订单信息
     */
    orderInfo: OrderInfo;

    /**
     * 订单结果
     */
    orderResult: string; // 订单结果，可能为空字符串

    /**
     * 任务预计时间
     */
    taskEstimateTime: number; // 任务预计时间，单位：秒
}

/**
 * 订单信息接口
 */
interface OrderInfo {
    /**
     * 订单ID
     */
    orderId: string; // 例如： "DKHJQ2022090510220905100562536FEF00062"

    /**
     * 失败类型
     */
    failType: number; // 失败类型，0 表示没有失败

    /**
     * 状态
     * 订单流程状态
     *  0：订单已创建
     *  3：订单处理中
     *  4：订单已完成
     *  -1：订单失败
     */
    status: number; // 订单状态，具体状态值根据业务定义

    /**
     * 原始持续时间
     */
    originalDuration: number; // 原始持续时间，单位：秒

    /**
     * 实际持续时间
     */
    realDuration: number; // 实际持续时间，单位：秒
}

export interface GetResultResponse {
    /**
     * 响应代码
     */
    code: string; // 例如： "000000"

    /**
     * 描述信息
     */
    descInfo: string; // 例如： "success"

    /**
     * 内容
     */
    content: Content;
}


export interface TransResult {
    segId: string; // 段落序号
    dst: string; // 翻译结果
    bg: number; // 开始时间
    ed: number; // 结束时间
    tags: string[]; // 标签
    roles: string[]; // 角色
}

export interface PredictResult {
    keywords: KeyWord[];
}

export interface KeyWord {
    word: string; // 质检关键词内容
    label: string; // 词库标签信息
    timeStamp: TimeStamp[];
}

export interface TimeStamp {
    bg: number; // 词出现的开启位置时间戳
    ed: number; // 词出现的结束位置时间戳
}

export interface Lattice {
    /**
     * 单个 vad 的结果的 json 内容
     * 解析后 {st: SentenceResult[]}
     */
    json_1best: {
        st:SentenceResult
    };
    lid?:string 
    /* 数字 */
    end?:string 
    /* 数字 */
    begin?:string
    /* 段落 */
    spk?:string
}

export interface SentenceResult {
    /* 单个句子的开始时间 */
    bg: string; // 
    /* 单个句子的结束时间 */
    ed: string; // 
    /* 分离的角色编号 */
    rl: string; // 
    pt?:string,
    sc?:string,
    pa?:string
    /* 输出词语识别结果集合 */
    rt: Array<{
        ws:WordRecognitionResult[]
    }>;
}

export interface WordRecognitionResult {
    wb: number; // 词语开始的帧数
    we: number; // 词语结束的帧数
    cw: WordCandidate[];
}

export interface WordCandidate {
    w: string; // 识别结果
    wp: string; // 词语的属性
}

export interface Label {
    rl_track: RoleTrack[];
}

export interface RoleTrack {
    rl: string; // 分离的角色编号
    track: string; // 音频轨道信息
}

// 语种支持
export type LanguageCode =
    | "cn"
    | "en"
    | "ja"
    | "ko"
    | "ru"
    | "fr"
    | "es"
    | "vi"
    | "cn_cantonese"
    | "cn_uyghur"
    | "cn_tibetan"
    | "ar"
    | "de"
    | "it";

// 错误码
export interface ErrorCode {
    code: number;
    description: string;
}

// 常见问题
export interface CommonQuestion {
    question: string;
    answer: string;
}
/**
 * 转录内容
 */
export interface OrderResult {
    lattice: Lattice[];
    lattice2?: Lattice[];
    label: Label[];
}