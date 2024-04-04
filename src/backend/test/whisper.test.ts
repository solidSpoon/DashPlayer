import { expect, test } from 'vitest'
import path from 'path';
import OpenAI from 'openai';
import fs from 'fs';
const openai = new OpenAI({
    apiKey: "sk-oxTSqN28uqFTRfJy515b24Dd06Be45Ca9c3071757862882d",
    baseURL: "https://oneapi.gptnb.me/v1/",
});
test("whisper", async () => {
    const filePath = path.resolve(__dirname, "test.mp3");
    console.log('transcript', filePath);
    const readStream = fs.createReadStream(filePath);
    console.log(readStream)
    const transcription = await openai.audio.transcriptions.create({
        file: readStream,
        model: "whisper-1",
        response_format: 'srt'
    });
    console.log('transcription.text');
    console.log(transcription);
})
