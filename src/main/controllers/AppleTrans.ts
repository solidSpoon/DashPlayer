/**
 * 调用 Bob 翻译
 * @param word
 */
export default function(word: string) {
    if (process.platform !== "darwin") {
        return;
    }
    word = word.replace("\"", " ");
    let script: string = "tell application \"Bob\"\n" +
        "launch\n" +
        `translate "${word}"\n` +
        "end tell";
    // runAppleScript(script);
    const applescript = require('applescript');
    applescript.execString(script);
}
