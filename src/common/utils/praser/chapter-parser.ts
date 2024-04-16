// 00:00:00 Intro
// 00:01:55 Chapter 1

import {strBlank, strNotBlank} from "@/common/utils/Util";
import {ParseResult} from "@/common/types/chapter-result";
import {number} from "zod";


function parseChapter(str: string) {
    //split the string by new line
    const lines = str.split('\n')
        .filter(strNotBlank)
        .map((line) => line.trim())
        .map(parseLine);
    // 调整时间
    for (let i = 0; i < lines.length; i++) {
        if (i + 1 < lines.length) {
            lines[i].timestampEnd = {...lines[i + 1].timestampStart};
        }
    }
    const lastLine = lines[lines.length - 1];
    lastLine.timestampEnd = {
        valid: true,
        value: '99:59:59'
    }
    // 开始时间必须小于结束时间
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].timestampStart.valid && lines[i].timestampEnd.valid) {
            const startSecond = timeStrToSecond(lines[i].timestampStart.value);
            const endSecond = timeStrToSecond(lines[i].timestampEnd.value)
            if (startSecond >= endSecond) {
                lines[i].timestampValid = false;
            }
        }
    }
    lastLine.timestampEnd = {
        valid: true,
        value: lastLine.timestampEnd.valid ? '99:59:59' : ''
    }
    return lines;
}

export function isTimeStrValid(timestamp: string) {
    // 00:00:00
    const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
    return timeRegex.test(timestamp);
}
export function timeStrToSecond(time: string) : number{
    const timeArray = time.split(':');
    return parseInt(timeArray[0]) * 3600 + parseInt(timeArray[1]) * 60 + parseInt(timeArray[2]);
}

function parseLine(line: string): ParseResult {
    // 按照第一个空格分割
    const firstSpaceIndex = line.indexOf(' ');
    let title = '';
    let timestamp = line;
    if (firstSpaceIndex !== -1) {
        timestamp = line.slice(0, firstSpaceIndex);
        title = line.slice(firstSpaceIndex + 1).trim();
    }
    // 判断时间戳是否合法
    const timestampValid = isTimeStrValid(timestamp);
    return {
        timestampStart: {
            valid: timestampValid,
            value: timestamp
        },
        timestampEnd: {
            valid: timestampValid,
            value: timestamp
        },
        timestampValid: true,
        title
    }
}

export default parseChapter;
