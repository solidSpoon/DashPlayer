import fs from 'fs';
import axios from 'axios';
// const openai = new OpenAI({
//     apiKey: "sk-oxTSqN28uqFTRfJy515b24Dd06Be45Ca9c3071757862882d",
//     baseURL: "https://oneapi.gptnb.me/v1/",
// });
import FormData from 'form-data';


import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';

import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import * as os from 'os';
import hash from '@/common/utils/hash';

class WhisperService {

    public static async transcript(filePath: string) {
        // await this.whisper();
        await this.convertAndSplit(filePath);
        const srt = await this.whisper(filePath);
        const srtName = filePath.replace(path.extname(filePath), '.srt');
        fs.writeFileSync(srtName, srt);
    }

    private static async whisper(filePath: string) {
        const data = new FormData();
        data.append('file', fs.createReadStream(filePath) as any);
        data.append('model', 'whisper-1');
        // data.append('language', 'en');
        data.append('response_format', 'srt');

        const config = {
            method: 'post',
            url: 'https://oneapi.gptnb.me/v1/audio/transcriptions',
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer sk-oxTSqN28uqFTRfJy515b24Dd06Be45Ca9c3071757862882d',
                'Content-Type': 'multipart/form-data',
                ...data.getHeaders()
            },
            data: data
        };

        try {
            const response = await axios(config);
            console.log(JSON.stringify(response.data));
            return response.data as string;
        } catch (error) {
            console.log(error);
        }
    }

    static async split() {
        ffmpeg.setFfmpegPath(ffmpegPath);
    }

    static async convertAndSplit(filePath: string) {
        const folderName = hash(filePath);
        const tempDir = path.join(os.tmpdir(), 'dp/whisper/', folderName);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        // 文件名为路径 hash
        console.log('tempDir', tempDir);
        const outputPath = path.join(tempDir, 'output.mp3');
        const maxFileSize = 25 * 1024 * 1024; // 25MB

        ffmpeg.setFfmpegPath(ffmpegPath);

        // Convert to mp3 with low quality
        await new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .format('mp3')
                .audioQuality(128)
                .output(outputPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
        console.log('outputPath', outputPath);

        // Check file size
        const stats = fs.statSync(outputPath);
        const fileSizeInBytes = stats.size;

        // If file size is larger than 25MB, split it
        if (fileSizeInBytes < maxFileSize) {
            return [outputPath];
        }
        const duration = await new Promise<number>((resolve, reject) => {
            ffmpeg.ffprobe(outputPath, (err, metadata) => {
                if (err) reject(err);
                else resolve(metadata.format.duration);
            });
        });

        const parts = Math.ceil(fileSizeInBytes / maxFileSize);
        const partDuration = duration / parts;

        const outputPartPaths: string[] = [];
        for (let i = 0; i < parts; i++) {
            const start = i * partDuration;
            const outputPartPath = path.join(tempDir, `output_part_${i}.mp3`);

            await new Promise((resolve, reject) => {
                ffmpeg(outputPath)
                    .setStartTime(start)
                    .setDuration(partDuration)
                    .output(outputPartPath)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
            console.log('outputPartPath', outputPartPath);
            outputPartPaths.push(outputPartPath);
        }
        return outputPartPaths;
    }
}


export default WhisperService;
