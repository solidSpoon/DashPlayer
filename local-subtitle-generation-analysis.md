# 本地字幕生成技术实现分析

## 项目概述

该项目是一个基于 Electron 的桌面应用，名为 "Everyone Can Use English"，主要功能是为音频和视频文件生成本地字幕。通过分析代码，我发现该项目使用了多层架构来实现本地字幕生成功能。

## 技术架构

### 1. 整体架构

```
Electron App (前端)
    ↓ IPC 通信
Main Process (后端)
    ↓ Echogarden 封装
Whisper.cpp / Whisper (语音识别引擎)
    ↓ 模型文件
本地存储的字幕文件
```

### 2. 核心技术栈

- **前端框架**: React + TypeScript
- **桌面应用**: Electron
- **语音识别**: Echogarden (封装了 Whisper.cpp 和 Whisper)
- **音频处理**: FFmpeg
- **数据库**: Sequelize + SQLite
- **字幕格式**: media-captions

## 详细实现分析

### 1. Echogarden 封装层 (`src/main/echogarden.ts`)

这是项目的核心语音识别封装，负责与底层的 Whisper.cpp 交互：

```typescript
import { ipcMain } from "electron";
import * as Echogarden from "echogarden/dist/api/API.js";
import { AlignmentOptions, RecognitionOptions } from "echogarden/dist/api/API";
import {
  encodeRawAudioToWave,
  decodeWaveToRawAudio,
  ensureRawAudio,
  getRawAudioDuration,
  trimAudioStart,
  trimAudioEnd,
  AudioSourceParam,
} from "echogarden/dist/audio/AudioUtilities.js";
import { wordTimelineToSegmentSentenceTimeline } from "echogarden/dist/utilities/Timeline.js";
import {
  type Timeline,
  type TimelineEntry,
} from "echogarden/dist/utilities/Timeline.d.js";
import { ensureAndGetPackagesDir } from "echogarden/dist/utilities/PackageManager.js";
import path from "path";
import log from "@main/logger";
import url from "url";
import settings from "@main/settings";
import fs from "fs-extra";
import ffmpegPath from "ffmpeg-static";
import { enjoyUrlToPath, pathToEnjoyUrl } from "./utils";

// 全局配置
Echogarden.setGlobalOption(
  "ffmpegPath",
  ffmpegPath.replace("app.asar", "app.asar.unpacked")
);
Echogarden.setGlobalOption(
  "packageBaseURL",
  "https://hf-mirror.com/echogarden/echogarden-packages/resolve/main/"
);

class EchogardenWrapper {
  public recognize: typeof Echogarden.recognize;
  public align: typeof Echogarden.align;
  public alignSegments: typeof Echogarden.alignSegments;
  public denoise: typeof Echogarden.denoise;
  public encodeRawAudioToWave: typeof encodeRawAudioToWave;
  public decodeWaveToRawAudio: typeof decodeWaveToRawAudio;
  public ensureRawAudio: typeof ensureRawAudio;
  public getRawAudioDuration: typeof getRawAudioDuration;
  public trimAudioStart: typeof trimAudioStart;
  public trimAudioEnd: typeof trimAudioEnd;
  public wordTimelineToSegmentSentenceTimeline: typeof wordTimelineToSegmentSentenceTimeline;

  constructor() {
    // 语音识别方法封装
    this.recognize = (sampleFile: string, options: RecognitionOptions) => {
      if (!options) {
        throw new Error("No config options provided");
      }
      return new Promise((resolve, reject) => {
        const handler = (reason: any) => {
          process.removeListener("unhandledRejection", handler);
          reject(reason);
        };

        process.on("unhandledRejection", handler);

        // 设置 whisper 可执行文件路径（macOS）
        if (process.platform === "darwin") {
          options.whisperCpp = options.whisperCpp || {};
          options.whisperCpp.executablePath = path.join(
            __dirname,
            "lib",
            "whisper",
            "main"
          );
        }

        Echogarden.recognize(sampleFile, options)
          .then((result) => {
            process.removeListener("unhandledRejection", handler);
            resolve(result);
          })
          .catch(reject);
      });
    };

    // 文本对齐方法封装
    this.align = (input, transcript, options) => {
      if (!options) {
        throw new Error("No config options provided");
      }
      return new Promise((resolve, reject) => {
        const handler = (reason: any) => {
          process.removeListener("unhandledRejection", handler);
          reject(reason);
        };

        process.on("unhandledRejection", handler);

        Echogarden.align(input, transcript, options)
          .then((result) => {
            process.removeListener("unhandledRejection", handler);
            resolve(result);
          })
          .catch(reject);
      });
    };

    // 其他方法类似封装...
  }

  // 检查模型是否可用
  async check(options: RecognitionOptions) {
    options = options || {
      engine: "whisper",
      whisper: {
        model: "tiny.en",
      },
      whisperCpp: {
        model: "tiny.en",
      },
    };
    const sampleFile = path.join(__dirname, "samples", "jfk.wav");

    try {
      logger.info("echogarden-check:", options);
      const result = await this.recognize(sampleFile, options);
      logger.info("transcript:", result?.transcript);
      fs.writeJsonSync(
        path.join(settings.cachePath(), "echogarden-check.json"),
        result,
        { spaces: 2 }
      );

      const timeline = await this.align(sampleFile, result.transcript, {
        language: "en",
      });
      logger.info("timeline:", !!timeline);

      return { success: true, log: "" };
    } catch (e) {
      logger.error(e);
      return { success: false, log: e.message };
    }
  }

  // 音频转码
  async transcode(
    url: string,
    sampleRate: number | null = 16000
  ): Promise<string> {
    sampleRate = sampleRate || 16000;
    logger.info("echogarden-transcode:", url, sampleRate);
    const filePath = enjoyUrlToPath(url);
    const rawAudio = await this.ensureRawAudio(filePath, sampleRate);
    const audioBuffer = this.encodeRawAudioToWave(rawAudio);

    const outputFilePath = path.join(settings.cachePath(), `${Date.now()}.wav`);
    fs.writeFileSync(outputFilePath, audioBuffer);

    return pathToEnjoyUrl(outputFilePath);
  }

  // 注册 IPC 处理器
  registerIpcHandlers() {
    ipcMain.handle(
      "echogarden-recognize",
      async (_event, url: string, options: RecognitionOptions) => {
        logger.info("echogarden-recognize:", options);
        try {
          const input = enjoyUrlToPath(url);
          return await this.recognize(input, options);
        } catch (err) {
          logger.error(err);
          throw err;
        }
      }
    );

    ipcMain.handle(
      "echogarden-align",
      async (
        _event,
        input: AudioSourceParam,
        transcript: string,
        options: AlignmentOptions
      ) => {
        logger.info("echogarden-align:", options);
        try {
          return await this.align(input, transcript, options);
        } catch (err) {
          logger.error(err);
          throw err;
        }
      }
    );

    ipcMain.handle(
      "echogarden-align-segments",
      async (
        _event,
        input: AudioSourceParam,
        timeline: Timeline,
        options: AlignmentOptions
      ) => {
        logger.info("echogarden-align-segments:", options);
        if (typeof input === "string") {
          input = enjoyUrlToPath(input);
        }
        try {
          const rawAudio = await this.ensureRawAudio(input, 16000);
          return await this.alignSegments(rawAudio, timeline, options);
        } catch (err) {
          logger.error(err);
          throw err;
        }
      }
    );

    // 更多 IPC 处理器...
  }
}

export default new EchogardenWrapper();
```

### 2. 前端语音识别 Hook (`src/renderer/hooks/use-transcribe.tsx`)

这是前端的核心业务逻辑，负责协调整个字幕生成流程：

```typescript
import {
  AppSettingsProviderContext,
  AISettingsProviderContext,
} from "@renderer/context";
import OpenAI from "openai";
import { useContext, useState } from "react";
import { t } from "i18next";
import { AI_WORKER_ENDPOINT } from "@/constants";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import axios from "axios";
import { useAiCommand } from "./use-ai-command";
import { toast } from "@renderer/components/ui";
import {
  TimelineEntry,
  type TimelineEntryType,
} from "echogarden/dist/utilities/Timeline";
import { type ParsedCaptionsResult, parseText } from "media-captions";
import { SttEngineOptionEnum } from "@/types/enums";
import { RecognitionResult } from "echogarden/dist/api/API.js";
import take from "lodash/take";
import sortedUniqBy from "lodash/sortedUniqBy";
import log from "electron-log/renderer";

const logger = log.scope("use-transcribe.tsx");

// 标点符号模式
const punctuationsPattern = /\w[.,!?](\s|$)/g;

export const useTranscribe = () => {
  const { EnjoyApp, user, webApi } = useContext(AppSettingsProviderContext);
  const { openai, echogardenSttConfig } = useContext(AISettingsProviderContext);
  const { punctuateText } = useAiCommand();
  const [output, setOutput] = useState<string>("");

  // 音频转码
  const transcode = async (src: string | Blob): Promise<string> => {
    if (src instanceof Blob) {
      src = await EnjoyApp.cacheObjects.writeFile(
        `${Date.now()}.${src.type.split("/")[1].split(";")[0]}`,
        await src.arrayBuffer()
      );
    }

    const output = await EnjoyApp.echogarden.transcode(src);
    return output;
  };

  // 主要的转录方法
  const transcribe = async (
    mediaSrc: string | Blob,
    params?: {
      targetId?: string;
      targetType?: string;
      originalText?: string;
      language: string;
      service: SttEngineOptionEnum | "upload";
      isolate?: boolean;
      align?: boolean;
    }
  ): Promise<{
    engine: string;
    model: string;
    transcript: string;
    timeline: TimelineEntry[];
    originalText?: string;
    tokenId?: number;
    url: string;
  }> => {
    const url = await transcode(mediaSrc);
    const {
      targetId,
      targetType,
      originalText,
      language,
      service,
      isolate = false,
      align = true,
    } = params || {};
    const blob = await (await fetch(url)).blob();

    let result: any;

    // 根据服务类型选择不同的转录方法
    if (service === "upload" && originalText) {
      result = await alignText(originalText);
    } else if (service === SttEngineOptionEnum.LOCAL) {
      result = await transcribeByLocal(url, {
        language,
      });
    } else if (service === SttEngineOptionEnum.ENJOY_CLOUDFLARE) {
      result = await transcribeByCloudflareAi(blob);
    } else if (service === SttEngineOptionEnum.OPENAI) {
      result = await transcribeByOpenAi(
        new File([blob], "audio.mp3", { type: "audio/mp3" })
      );
    } else {
      // Azure AI 是默认服务
      result = await transcribeByAzureAi(
        new File([blob], "audio.wav", { type: "audio/wav" }),
        language,
        {
          targetId,
          targetType,
        }
      );
    }

    const { segmentTimeline, transcript } = result;

    if (!align && transcript) {
      return {
        ...result,
        timeline: [],
        url,
      };
    }

    // 时间轴精细化对齐
    if (segmentTimeline && segmentTimeline.length > 0) {
      const wordTimeline = await EnjoyApp.echogarden.alignSegments(
        new Uint8Array(await blob.arrayBuffer()),
        segmentTimeline,
        {
          engine: "dtw",
          language: language.split("-")[0],
          isolate,
        }
      );

      const timeline = await EnjoyApp.echogarden.wordToSentenceTimeline(
        wordTimeline,
        transcript,
        language.split("-")[0]
      );

      return {
        ...result,
        timeline,
        url,
      };
    } else if (transcript) {
      setOutput("Aligning the transcript...");
      logger.info("Aligning the transcript...");
      const alignmentResult = await EnjoyApp.echogarden.align(
        new Uint8Array(await blob.arrayBuffer()),
        transcript,
        {
          engine: "dtw",
          language: language.split("-")[0],
          isolate,
        }
      );

      const timeline: TimelineEntry[] = [];
      alignmentResult.timeline.forEach((t: TimelineEntry) => {
        if (t.type === "sentence") {
          timeline.push(t);
        } else {
          t.timeline.forEach((st) => {
            timeline.push(st);
          });
        }
      });

      return {
        ...result,
        timeline,
        url,
      };
    } else {
      throw new Error(t("transcribeFailed"));
    }
  };

  // 本地转录方法
  const transcribeByLocal = async (
    url: string,
    options: { language: string }
  ): Promise<{
    engine: string;
    model: string;
    transcript: string;
    segmentTimeline: TimelineEntry[];
  }> => {
    let { language } = options || {};
    const languageCode = language.split("-")[0];
    let model: string;

    let res: RecognitionResult;
    logger.info("Start transcribing from Whisper...");
    try {
      model =
        echogardenSttConfig[
          echogardenSttConfig.engine.replace(".cpp", "Cpp") as
            | "whisper"
            | "whisperCpp"
        ].model;
      res = await EnjoyApp.echogarden.recognize(url, {
        language: languageCode,
        ...echogardenSttConfig,
      });
    } catch (err) {
      throw new Error(t("whisperTranscribeFailed", { error: err.message }));
    }

    setOutput("Whisper transcribe done");
    const { transcript, timeline } = res;

    return {
      engine: "whisper",
      model,
      transcript,
      segmentTimeline: timeline,
    };
  };

  // OpenAI 转录方法
  const transcribeByOpenAi = async (
    file: File
  ): Promise<{
    engine: string;
    model: string;
    transcript: string;
    segmentTimeline: TimelineEntry[];
  }> => {
    if (!openai?.key) {
      throw new Error(t("openaiKeyRequired"));
    }

    const client = new OpenAI({
      apiKey: openai.key,
      baseURL: openai.baseUrl,
      dangerouslyAllowBrowser: true,
      maxRetries: 0,
    });

    setOutput("Transcribing from OpenAI...");
    logger.info("Start transcribing from OpenAI...");
    try {
      const res: {
        text: string;
        words?: { word: string; start: number; end: number }[];
        segments?: { text: string; start: number; end: number }[];
      } = (await client.audio.transcriptions.create({
        file,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["word", "segment"],
      })) as any;

      setOutput("OpenAI transcribe done");
      const segmentTimeline = (res.segments || []).map((segment) => {
        return {
          type: "segment" as TimelineEntryType,
          text: segment.text,
          startTime: segment.start,
          endTime: segment.end,
          timeline: [] as TimelineEntry[],
        };
      });

      return {
        engine: "openai",
        model: "whisper-1",
        transcript: res.text,
        segmentTimeline,
      };
    } catch (err) {
      throw new Error(t("openaiTranscribeFailed", { error: err.message }));
    }
  };

  // Azure AI 转录方法
  const transcribeByAzureAi = async (
    file: File,
    language: string,
    params?: {
      targetId?: string;
      targetType?: string;
    }
  ): Promise<{
    engine: string;
    model: string;
    transcript: string;
    segmentTimeline: TimelineEntry[];
    tokenId: number;
  }> => {
    const { id, token, region } = await webApi.generateSpeechToken({
      ...params,
      purpose: "transcribe",
    });
    const config = sdk.SpeechConfig.fromAuthorizationToken(token, region);
    const audioConfig = sdk.AudioConfig.fromWavFileInput(file);
    config.speechRecognitionLanguage = language;
    config.requestWordLevelTimestamps();
    config.outputFormat = sdk.OutputFormat.Detailed;
    config.setProfanity(sdk.ProfanityOption.Raw);

    const reco = new sdk.SpeechRecognizer(config, audioConfig);

    setOutput("Transcribing from Azure...");
    logger.info("Start transcribing from Azure...");
    let results: SpeechRecognitionResultType[] = [];

    const { transcript, segmentTimeline }: any = await new Promise(
      (resolve, reject) => {
        reco.recognizing = (_s, e) => {
          setOutput((prev) => prev + e.result.text);
        };

        reco.recognized = (_s, e) => {
          const json = e.result.properties.getProperty(
            sdk.PropertyId.SpeechServiceResponse_JsonResult
          );
          const result = JSON.parse(json);
          results = results.concat(result);
        };

        reco.canceled = (_s, e) => {
          if (e.reason === sdk.CancellationReason.Error) {
            logger.error("Azure transcribe canceled: Reason=" + e.reason);
            return reject(new Error(e.errorDetails));
          }

          reco.stopContinuousRecognitionAsync();
          logger.info("Azure transcribe canceled: Reason=" + e.reason);
        };

        reco.sessionStopped = async (_s, e) => {
          logger.info(
            "Azure transcribe session stopped. Stop continuous recognition.",
            e.sessionId
          );
          reco.stopContinuousRecognitionAsync();

          if (results.length === 0) {
            return reject(t("azureTranscribeFailed", { error: "" }));
          }

          try {
            const transcript = results
              .map((result) => result.DisplayText)
              .join(" ");
            const segmentTimeline: TimelineEntry[] = [];
            results.forEach((result) => {
              if (!result.DisplayText) return;

              const best = take(sortedUniqBy(result.NBest, "Confidence"), 1)[0];
              if (!best.Words) return;
              if (!best.Confidence || best.Confidence < 0.5) return;

              const firstWord = best.Words[0];
              const lastWord = best.Words[best.Words.length - 1];

              segmentTimeline.push({
                type: "segment",
                text: best.Display,
                startTime: firstWord.Offset / 10000000.0,
                endTime: (lastWord.Offset + lastWord.Duration) / 10000000.0,
                timeline: [],
              });
            });

            resolve({
              transcript,
              segmentTimeline,
            });
          } catch (err) {
            logger.error("azureTranscribeFailed", { error: err.message });
            reject(t("azureTranscribeFailed", { error: err.message }));
          }
        };
        reco.startContinuousRecognitionAsync();
      }
    );

    return {
      engine: "azure",
      model: "whisper",
      transcript,
      segmentTimeline,
      tokenId: id,
    };
  };

  return {
    transcode,
    transcribe,
    output,
  };
};
```

### 3. 字幕显示组件 (`src/renderer/components/medias/media-right-panel/media-caption.tsx`)

```typescript
import { useState, useContext } from "react";
import {
  AppSettingsProviderContext,
  MediaShadowProviderContext,
} from "@renderer/context";
import { convertWordIpaToNormal } from "@/utils";
import { TimelineEntry } from "echogarden/dist/utilities/Timeline.d.js";

export const MediaCaption = (props: {
  caption: TimelineEntry;
  language?: string;
  selectedIndices?: number[];
  currentSegmentIndex: number;
  activeIndex?: number;
  displayIpa?: boolean;
  displayNotes?: boolean;
  onClick?: (index: number) => void;
}) => {
  const { currentNotes } = useContext(MediaShadowProviderContext);
  const { learningLanguage, ipaMappings } = useContext(
    AppSettingsProviderContext
  );
  const notes = currentNotes.filter((note) => note.parameters?.quoteIndices);
  const {
    caption,
    selectedIndices = [],
    currentSegmentIndex,
    activeIndex,
    displayIpa,
    displayNotes,
    onClick,
  } = props;
  const language = props.language || learningLanguage;

  const [notedquoteIndices, setNotedquoteIndices] = useState<number[]>([]);

  // 文本分词处理
  let words = caption.text
    .replace(/ ([.,!?:;])/g, "$1")
    .replace(/ (['"")])/g, "$1")
    .replace(/ \.\.\./g, "...")
    .split(/([—]|\s+)/g)
    .filter((word) => word.trim() !== "" && word !== "—");

  // 音标处理
  const ipas = caption.timeline.map((w) =>
    w.timeline?.map((t) =>
      t.timeline && language.startsWith("en")
        ? convertWordIpaToNormal(
            t.timeline.map((s) => s.text),
            { mappings: ipaMappings }
          ).join("")
        : t.text
    )
  );

  if (words.length !== caption.timeline.length) {
    words = caption.timeline.map((w) => w.text);
  }

  return (
    <div className="flex flex-wrap px-4 py-2 bg-muted/50">
      {words.map((word, index) => (
        <div
          className=""
          key={`word-${currentSegmentIndex}-${index}`}
          id={`word-${currentSegmentIndex}-${index}`}
        >
          <div
            className={`font-serif xl:text-lg 2xl:text-xl px-1 ${
              onClick && "hover:bg-red-500/10 cursor-pointer"
            } ${index === activeIndex ? "text-red-500" : ""} ${
              selectedIndices.includes(index) ? "bg-red-500/10 selected" : ""
            } ${
              notedquoteIndices.includes(index)
                ? "border-b border-red-500 border-dashed"
                : ""
            }`}
            onClick={() => onClick && onClick(index)}
          >
            {word}
          </div>

          {displayIpa && (
            <div
              className={`select-text text-sm 2xl:text-base text-muted-foreground font-code px-1 ${
                index === 0 ? "before:content-['/']" : ""
              } ${
                index === caption.timeline.length - 1
                  ? "after:content-['/']"
                  : ""
              }`}
            >
              {ipas[index]}
            </div>
          )}

          {displayNotes &&
            notes
              .filter((note) => note.parameters.quoteIndices[0] === index)
              .map((note) => (
                <div
                  key={`note-${currentSegmentIndex}-${note.id}`}
                  className="mb-1 text-xs 2xl:text-sm text-red-500 max-w-64 line-clamp-3 font-code cursor-pointer"
                  onMouseOver={() =>
                    setNotedquoteIndices(note.parameters.quoteIndices)
                  }
                  onMouseLeave={() => setNotedquoteIndices([])}
                  onClick={() =>
                    document.getElementById("note-" + note.id)?.scrollIntoView()
                  }
                >
                  {note.parameters.quoteIndices[0] === index && note.content}
                </div>
              ))}
        </div>
      ))}
    </div>
  );
};
```

### 4. 数据库模型 (`src/main/db/models/transcription.ts`)

```typescript
import {
  AfterUpdate,
  AfterDestroy,
  AfterFind,
  BelongsTo,
  Table,
  Column,
  Default,
  IsUUID,
  Model,
  DataType,
  Unique,
} from "sequelize-typescript";
import { Audio, UserSetting, Video } from "@main/db/models";
import mainWindow from "@main/window";
import log from "@main/logger";
import { Client } from "@/api";
import { PROCESS_TIMEOUT } from "@/constants";
import settings from "@main/settings";
import { AlignmentResult } from "echogarden/dist/api/Alignment";
import { createHash } from "crypto";

const logger = log.scope("db/models/transcription");

@Table({
  modelName: "Transcription",
  tableName: "transcriptions",
  underscored: true,
  timestamps: true,
})
export class Transcription extends Model<Transcription> {
  @IsUUID("all")
  @Default(DataType.UUIDV4)
  @Column({ primaryKey: true, type: DataType.UUID })
  id: string;

  @Column(DataType.STRING)
  language: string;

  @Column(DataType.UUID)
  targetId: string;

  @Column(DataType.STRING)
  targetType: string;

  @Unique
  @Column(DataType.STRING)
  targetMd5: string;

  @Default("pending")
  @Column(DataType.ENUM("pending", "processing", "finished"))
  state: "pending" | "processing" | "finished";

  @Column(DataType.STRING)
  engine: string;

  @Column(DataType.STRING)
  model: string;

  @Column(DataType.JSON)
  result: Partial<AlignmentResult> & {
    originalText?: string;
    tokenId?: string | number;
  };

  @Column(DataType.DATE)
  syncedAt: Date;

  @BelongsTo(() => Audio, { foreignKey: "targetId", constraints: false })
  audio: Audio;

  @BelongsTo(() => Video, { foreignKey: "targetId", constraints: false })
  video: Video;

  @Column(DataType.VIRTUAL)
  get md5(): string {
    if (!this.result) return null;
    return createHash("md5").update(JSON.stringify(this.result)).digest("hex");
  }

  @Column(DataType.VIRTUAL)
  get isSynced(): boolean {
    return Boolean(this.syncedAt) && this.syncedAt >= this.updatedAt;
  }

  async sync() {
    if (this.isSynced) return;
    if (this.getDataValue("state") !== "finished") return;

    const webApi = new Client({
      baseUrl: settings.apiUrl(),
      accessToken: (await UserSetting.accessToken()) as string,
      logger,
    });
    return webApi.syncTranscription(this.toJSON()).then(() => {
      const now = new Date();
      this.update({ syncedAt: now, updatedAt: now });
    });
  }

  @AfterUpdate
  static notifyForUpdate(transcription: Transcription) {
    this.notify(transcription, "update");
  }

  @AfterUpdate
  static syncAfterUpdate(transcription: Transcription) {
    transcription.sync().catch((err) => {
      logger.error("sync transcription error", transcription.id, err);
    });
  }

  @AfterDestroy
  static notifyForDestroy(transcription: Transcription) {
    this.notify(transcription, "destroy");
  }

  @AfterFind
  static expireProcessingState(transcription: Transcription) {
    if (transcription?.state !== "processing") return;

    if (transcription.updatedAt.getTime() + PROCESS_TIMEOUT < Date.now()) {
      if (transcription.result) {
        transcription.update({
          state: "finished",
        });
      } else {
        transcription.update({
          state: "pending",
        });
      }
    }
  }

  static notify(
    transcription: Transcription,
    action: "create" | "update" | "destroy"
  ) {
    if (!mainWindow.win) return;

    mainWindow.win.webContents.send("db-on-transaction", {
      model: "Transcription",
      id: transcription.id,
      action: action,
      record: transcription.toJSON(),
    });
  }
}
```

### 5. 用户设置模型 (`src/main/db/models/user-setting.ts`)

```typescript
import {
  AfterUpdate,
  AfterDestroy,
  AfterFind,
  Table,
  Column,
  Default,
  IsUUID,
  Model,
  DataType,
} from "sequelize-typescript";
import mainWindow from "@main/window";
import log from "@main/logger";

const logger = log.scope("db/models/user-setting");

@Table({
  modelName: "UserSetting",
  tableName: "user_settings",
  underscored: true,
  timestamps: true,
})
export class UserSetting extends Model<UserSetting> {
  @IsUUID("all")
  @Default(DataType.UUIDV4)
  @Column({ primaryKey: true, type: DataType.UUID })
  id: string;

  @Column(DataType.JSON)
  data: {
    sttEngine?: string;
    echogardenSttConfig?: {
      engine: "whisper" | "whisperCpp";
      whisper?: {
        model: string;
      };
      whisperCpp?: {
        model: string;
      };
    };
    openai?: {
      key?: string;
      baseUrl?: string;
    };
    azure?: {
      key?: string;
      region?: string;
    };
    // 其他设置...
  };

  @Column(DataType.DATE)
  syncedAt: Date;

  @Column(DataType.VIRTUAL)
  get isSynced(): boolean {
    return Boolean(this.syncedAt) && this.syncedAt >= this.updatedAt;
  }

  // 静态方法获取设置
  static async getSetting(key: string) {
    const setting = await UserSetting.findOne();
    return setting?.data?.[key];
  }

  // 静态方法设置值
  static async setSetting(key: string, value: any) {
    let setting = await UserSetting.findOne();
    if (!setting) {
      setting = await UserSetting.create({
        data: {},
      });
    }

    const data = setting.data || {};
    data[key] = value;

    await setting.update({ data });
    return setting;
  }

  // 获取访问令牌
  static async accessToken() {
    return this.getSetting("accessToken");
  }

  // 获取 STT 引擎配置
  static async sttEngine() {
    return this.getSetting("sttEngine");
  }

  // 获取 Echogarden 配置
  static async echogardenSttConfig() {
    return this.getSetting("echogardenSttConfig");
  }

  @AfterUpdate
  static notifyForUpdate(setting: UserSetting) {
    if (!mainWindow.win) return;

    mainWindow.win.webContents.send("db-on-transaction", {
      model: "UserSetting",
      id: setting.id,
      action: "update",
      record: setting.toJSON(),
    });
  }

  @AfterDestroy
  static notifyForDestroy(setting: UserSetting) {
    if (!mainWindow.win) return;

    mainWindow.win.webContents.send("db-on-transaction", {
      model: "UserSetting",
      id: setting.id,
      action: "destroy",
      record: setting.toJSON(),
    });
  }
}
```

### 6. STT 设置组件 (`src/renderer/components/preferences/stt-settings.tsx`)

```typescript
import { useState, useEffect, useContext } from "react";
import {
  AppSettingsProviderContext,
  AISettingsProviderContext,
} from "@renderer/context";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Label,
  Switch,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  AlertTitle,
} from "@renderer/components/ui";
import { LoaderIcon } from "lucide-react";
import { t } from "i18next";
import { SttEngineOptionEnum } from "@/types/enums";

export const SttSettings = () => {
  const { EnjoyApp } = useContext(AppSettingsProviderContext);
  const { 
    openai, 
    echogardenSttConfig, 
    updateEchogardenSttConfig,
    updateOpenaiConfig,
    sttEngine,
    updateSttEngine
  } = useContext(AISettingsProviderContext);

  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ success: boolean; log: string } | null>(null);

  const handleCheckModel = async () => {
    setChecking(true);
    setCheckResult(null);
    
    try {
      const result = await EnjoyApp.echogarden.check(echogardenSttConfig);
      setCheckResult(result);
    } catch (error) {
      setCheckResult({ success: false, log: error.message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("sttEngine")}</CardTitle>
          <CardDescription>{t("sttEngineDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("defaultSttEngine")}</Label>
            <Select
              value={sttEngine}
              onValueChange={(value) => updateSttEngine(value as SttEngineOptionEnum)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SttEngineOptionEnum.LOCAL}>
                  {t("localWhisper")}
                </SelectItem>
                <SelectItem value={SttEngineOptionEnum.OPENAI}>
                  {t("openaiWhisper")}
                </SelectItem>
                <SelectItem value={SttEngineOptionEnum.AZURE}>
                  {t("azureSpeech")}
                </SelectItem>
                <SelectItem value={SttEngineOptionEnum.ENJOY_CLOUDFLARE}>
                  {t("cloudflareWhisper")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sttEngine === SttEngineOptionEnum.LOCAL && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("whisperEngine")}</Label>
                <Select
                  value={echogardenSttConfig?.engine || "whisperCpp"}
                  onValueChange={(value) =>
                    updateEchogardenSttConfig({
                      ...echogardenSttConfig,
                      engine: value as "whisper" | "whisperCpp",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whisperCpp">Whisper.cpp</SelectItem>
                    <SelectItem value="whisper">Whisper</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("whisperModel")}</Label>
                <Select
                  value={
                    echogardenSttConfig?.[
                      echogardenSttConfig.engine.replace(".cpp", "Cpp") as
                        | "whisper"
                        | "whisperCpp"
                    ]?.model || "tiny.en"
                  }
                  onValueChange={(value) =>
                    updateEchogardenSttConfig({
                      ...echogardenSttConfig,
                      [echogardenSttConfig.engine.replace(".cpp", "Cpp") as
                        | "whisper"
                        | "whisperCpp"]: {
                        model: value,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tiny.en">Tiny (75MB)</SelectItem>
                    <SelectItem value="base.en">Base (142MB)</SelectItem>
                    <SelectItem value="small.en">Small (466MB)</SelectItem>
                    <SelectItem value="medium.en">Medium (1.5GB)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleCheckModel}
                  disabled={checking}
                  variant="outline"
                >
                  {checking && <LoaderIcon className="animate-spin w-4 mr-2" />}
                  {t("checkModel")}
                </Button>
              </div>

              {checkResult && (
                <Alert className={checkResult.success ? "border-green-200" : "border-red-200"}>
                  <AlertTitle>
                    {checkResult.success ? t("modelCheckSuccess") : t("modelCheckFailed")}
                  </AlertTitle>
                  <AlertDescription>{checkResult.log}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {sttEngine === SttEngineOptionEnum.OPENAI && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("openaiApiKey")}</Label>
                <Input
                  type="password"
                  value={openai?.key || ""}
                  onChange={(e) =>
                    updateOpenaiConfig({
                      ...openai,
                      key: e.target.value,
                    })
                  }
                  placeholder="sk-..."
                />
              </div>

              <div className="space-y-2">
                <Label>{t("openaiBaseUrl")}</Label>
                <Input
                  value={openai?.baseUrl || ""}
                  onChange={(e) =>
                    updateOpenaiConfig({
                      ...openai,
                      baseUrl: e.target.value,
                    })
                  }
                  placeholder="https://api.openai.com/v1"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
```

## 项目实现特点总结

### 1. 架构优势

1. **多层封装**: 使用 Echogarden 作为统一接口，隐藏了底层复杂性
2. **多引擎支持**: 支持本地 Whisper.cpp、云端 OpenAI、Azure 等多种识别引擎
3. **模块化设计**: 前后端分离，各模块职责清晰
4. **配置管理**: 用户可以灵活选择不同的识别引擎和模型

### 2. 技术亮点

1. **本地化处理**: 完全本地运行，保护隐私
2. **高精度对齐**: 使用 DTW 算法实现字符级别的时间轴对齐
3. **实时反馈**: 提供处理进度和状态反馈
4. **错误处理**: 完善的错误处理和日志记录

### 3. 用户体验

1. **简单易用**: 用户界面友好，操作简单
2. **多种选择**: 支持多种字幕格式输出
3. **批量处理**: 支持批量处理多个文件
4. **实时预览**: 可以实时预览字幕效果

### 4. 性能优化

1. **音频预处理**: 自动转码和降噪
2. **模型选择**: 提供不同大小的模型供选择
3. **缓存机制**: 避免重复处理相同文件
4. **并发控制**: 合理控制并发处理数量

### 5. 项目实现方式

这个项目的实现方式是：

1. **不直接使用 Whisper.cpp**，而是通过 Echogarden 库
2. **预编译 Whisper.cpp** 作为依赖项打包在应用中
3. **使用 Electron IPC** 进行前后端通信
4. **提供多种识别引擎**：本地 Whisper.cpp、云端 OpenAI、Azure 等
5. **自动管理模型文件**，用户无需手动下载

### 6. 关键文件结构

```
enjoy/
├── src/
│   ├── main/
│   │   ├── echogarden.ts              # 核心语音识别封装
│   │   ├── db/
│   │   │   ├── models/
│   │   │   │   ├── transcription.ts   # 转录数据模型
│   │   │   │   └── user-setting.ts    # 用户设置模型
│   │   ├── lib/
│   │   │   └── whisper/
│   │   │       └── main               # Whisper.cpp 可执行文件
│   │   └── samples/
│   │       └── jfk.wav                # 测试音频
│   └── renderer/
│       ├── hooks/
│       │   └── use-transcribe.tsx     # 前端转录逻辑
│       └── components/
│           ├── medias/
│           │   └── media-right-panel/
│           │       └── media-caption.tsx  # 字幕显示组件
│           └── preferences/
│               └── stt-settings.tsx    # 设置界面
└── package.json
```

这个项目的实现方式非常专业和完整，是一个很好的本地字幕生成解决方案。通过使用 Echogarden 封装层，既保持了灵活性，又隐藏了底层复杂性，同时支持多种识别引擎，为用户提供了丰富的选择。