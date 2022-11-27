import { ipcMain } from "electron";
import { updateProgress, queryProgress } from "./controllers/ProgressController";
import { batchTranslate } from "./controllers/Translate";
import transWord from "./controllers/AppleTrans";

export function registerHandler() {
    ipcMain.on("update-process", async (event, arg) => {
        console.log("ipcMain update-process", arg);
        event.reply("update-process", "success");
    });
    ipcMain.on("trans-word", async (event, arg) => {
        console.log("trans-words", arg);
        transWord(arg[0]);
        event.reply("update-process", "success");
    });
    ipcMain.on("update-progress", async (event, args: any[]) => {
        const [fileName, progress] = args;
        console.log("update-progress", fileName, progress);
        await updateProgress(fileName, progress);
        event.reply("update-progress", "success");
    });
    ipcMain.on("query-progress", async (event, args: any[]) => {
        const [fileName] = args;
        console.log("query-progress", fileName);
        let progress = await queryProgress(fileName);
        console.log(`query-progress file: ${fileName}, progress: ${progress}`);
        event.reply("query-progress", progress);
    });
    ipcMain.on("batch-translate", async (event, args: any[]) => {
        const strs = args[0];
        console.log("batch-translate");
        let translateResult = await batchTranslate(strs);
        console.log("server tranlate result", translateResult);
        event.reply("batch-translate", translateResult);
    });
}
