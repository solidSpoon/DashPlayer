import fs from 'fs';
import axios from 'axios';
// const openai = new OpenAI({
// //     apiKey: "sk-oxTSqN28uqFTRfJy515b24Dd06Be45Ca9c3071757862882d",
// //     baseURL: "https://oneapi.gptnb.me/v1/",
// // });
// import FormData from 'form-data';
//
// class WhisperService {
//
//     public static async transcript(filePath: string) {
//         // await this.extracted();
//         // await this.convertAndSplit(filePath);
//     }
//
//     private static async extracted() {
//         const data = new FormData();
//         data.append('file', fs.createReadStream('/Users/solidspoon/Desktop/test.mp3') as any);
//         data.append('model', 'whisper-1');
//         // data.append('language', 'en');
//         data.append('response_format', 'srt');
//
//         const config = {
//             method: 'post',
//             url: 'https://oneapi.gptnb.me/v1/audio/transcriptions',
//             headers: {
//                 'Accept': 'application/json',
//                 'Authorization': 'Bearer sk-oxTSqN28uqFTRfJy515b24Dd06Be45Ca9c3071757862882d',
//                 'Content-Type': 'multipart/form-data',
//                 ...data.getHeaders()
//             },
//             data: data
//         };
//
//         try {
//             const response = await axios(config);
//             console.log(JSON.stringify(response.data));
//         } catch (error) {
//             console.log(error);
//         }
//     }
//
//     static async split() {
//         // ffmpeg.setFfmpegPath(ffmpegPath);
//         // const command = Ffmpeg();
//     }
//
//     // static async convertAndSplit(filePath: string) {
//     //     const tempDir = os.tmpdir();
//     //     console.log('tempDir', tempDir);
//     //     const outputPath = path.join(tempDir, 'output.mp3');
//     //     const maxFileSize = 25 * 1024 * 1024; // 25MB
//     //
//     //     ffmpeg.setFfmpegPath(ffmpegPath);
//     //
//     //     // Convert to mp3 with low quality
//     //     await new Promise((resolve, reject) => {
//     //         ffmpeg(filePath)
//     //             .format('mp3')
//     //             .audioQuality(128)
//     //             .output(outputPath)
//     //             .on('end', resolve)
//     //             .on('error', reject)
//     //             .run();
//     //     });
//     //
//     //     // Check file size
//     //     const stats = fs.statSync(outputPath);
//     //     const fileSizeInBytes = stats.size;
//     //
//     //     // If file size is larger than 25MB, split it
//     //     if (fileSizeInBytes > maxFileSize) {
//     //         const duration = await new Promise<number>((resolve, reject) => {
//     //             ffmpeg.ffprobe(outputPath, (err, metadata) => {
//     //                 if (err) reject(err);
//     //                 else resolve(metadata.format.duration);
//     //             });
//     //         });
//     //
//     //         const parts = Math.ceil(fileSizeInBytes / maxFileSize);
//     //         const partDuration = duration / parts;
//     //
//     //         for (let i = 0; i < parts; i++) {
//     //             const start = i * partDuration;
//     //             const outputPartPath = path.join(tempDir, `output_part_${i}.mp3`);
//     //
//     //             await new Promise((resolve, reject) => {
//     //                 ffmpeg(outputPath)
//     //                     .setStartTime(start)
//     //                     .setDuration(partDuration)
//     //                     .output(outputPartPath)
//     //                     .on('end', resolve)
//     //                     .on('error', reject)
//     //                     .run();
//     //             });
//     //         }
//     //     }
//     // }
// }
//
// export default WhisperService;
