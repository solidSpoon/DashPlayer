/**
 * 调用 Bob 翻译
 * @param word
 */
import { app } from "electron";

export default function(word: string) {
    if (process.platform !== "darwin") {
        return;
    }
    console.log(app.getPath('userData'));
    word = word.replace("\"", " ");
    let script: string = "tell application \"Bob\"\n" +
        "launch\n" +
        `translate "${word}"\n` +
        "end tell";
    // runAppleScript(script);
    const applescript = require('applescript');
    applescript.execString(script);
}
