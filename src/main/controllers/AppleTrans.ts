/**
 * 调用 Bob 翻译
 * @param word
 */
import { app } from 'electron';
import log from 'electron-log';

const applescript = require('applescript');

export default function transWord(word: string) {
    if (process.platform !== 'darwin') {
        return;
    }
    const replacedWord = word.replace('"', ' ');
    const script: string =
        'tell application "Bob"\n' +
        'launch\n' +
        `translate "${replacedWord}"\n` +
        'end tell';

    applescript.execString(script);

    log.info(app.getPath('userData'));
}
