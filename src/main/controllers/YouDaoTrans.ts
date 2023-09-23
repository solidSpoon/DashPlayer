import axios from 'axios';
import fs from 'fs';
import { ChildProcess } from 'child_process';
import player from 'play-sound';
import { app } from 'electron';
import KeyValueCache from '../ServerLib/KeyValueCache';
import WordTransCache from '../ServerLib/WordTransCache';
import YouDaoTranslater, { YouDaoConfig } from '../ServerLib/YouDaoTranslater';

const config: YouDaoConfig = {
    from: 'zh_CHS', // zh-CHS(中文) || ja(日语) || EN(英文) || fr(法语) ...
    to: 'EN',
    appKey: '', // https://ai.youdao.com 在有道云上进行注册
    secretKey: '',
};

const youDao = new YouDaoTranslater(config);

const youDaoTrans = async (str: string) => {
    const cacheRes = await WordTransCache.queryValue(str);
    if (cacheRes) {
        return cacheRes;
    }
    const appKey = await KeyValueCache.queryValue('youDaoSecretId');
    const secretKey = await KeyValueCache.queryValue('youDaoSecretKey');
    if (!appKey || !secretKey) {
        return null;
    }
    const c: YouDaoConfig = {
        from: 'zh_CHS', // zh-CHS(中文) || ja(日语) || EN(英文) || fr(法语) ...
        to: 'EN',
        appKey,
        secretKey,
    };
    youDao.updateConfig(c);
    const onlineRes = await youDao.translate(str);
    if (!onlineRes) {
        return null;
    }
    await WordTransCache.updateValue(str, onlineRes);
    return onlineRes;
};
export default youDaoTrans;
// let currentPlaying: HTMLAudioElement;
let playerProcess: ChildProcess | null = null;

const playerInstance = player();

let fileIndex = 0;

function doPlay(
    path: string,
    resolve: (value: PromiseLike<boolean> | boolean) => void
) {
    playerProcess = playerInstance.play(
        path,
        {
            afplay: ['-v', 0.3],
        },
        (err) => {
            if (err) {
                console.error(err);
                resolve(false);
            }
            fs.unlinkSync(path); // 播放完成后删除临时文件
            resolve(true);
        }
    );
}

const playSound = async (url: string): Promise<boolean> => {
    const res = await axios.get(url, { responseType: 'stream' });
    // 创建可写流，保存音频文件
    fileIndex += 1;
    const bashPath = app.getPath('userData');
    const path = `${bashPath}/temp/dash-player-youdao-pronounce${fileIndex}.mp3`;
    if (!fs.existsSync(`${bashPath}/temp`)) {
        fs.mkdirSync(`${bashPath}/temp`);
    }
    const file = fs.createWriteStream(path);
    res.data.pipe(file);
    const success = await new Promise<boolean>((resolve, reject) => {
        file.on('finish', async () => {
            playerProcess?.kill();
            doPlay(path, resolve);
        });
    });
    return success;
};

// 导出
export { playSound };
