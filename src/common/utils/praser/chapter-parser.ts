// 00:00:00 Intro
// 00:01:55 Chapter 1

import {ChapterParseResult} from "@/common/types/chapter-result";
import TimeUtil from "@/common/utils/TimeUtil";
import StrUtil from '@/common/utils/str-util';


function parseChapter(str: string) {
    //split the string by new line
    const lines = str.split('\n')
        .filter(StrUtil.isNotBlank)
        .map((line) => line.trim())
        .map(parseLine);
    if (lines.length > 0) {
        if (lines[0].timestampStart !== '00:00:00') {
            lines.unshift({
                timestampStart: '00:00:00',
                timestampEnd: '00:00:00',
                title: 'Intro Auto Generated',
                timestampValid: true,
                original: ''
            })
        }
    }
    // 调整时间
    for (let i = 0; i < lines.length; i++) {
        if (i + 1 < lines.length) {
            lines[i].timestampEnd = lines[i + 1].timestampStart;
        }
    }
    const lastLine = lines[lines.length - 1];
    lastLine.timestampEnd = '99:59:59';
    // 开始时间必须小于结束时间
    for (let i = 0; i < lines.length; i++) {

        const startSecond = TimeUtil.parseDuration(lines[i].timestampStart);
        const endSecond = TimeUtil.parseDuration(lines[i].timestampEnd)
        if (startSecond > endSecond - 60) {
            lines[i].timestampValid = false;
        }

    }
    return lines;
}


function parseLine(line: string): ChapterParseResult {
    // 按照第一个空格分割
    const firstSpaceIndex = line.indexOf(' ');
    let title = '';
    let timestamp = line;
    if (firstSpaceIndex !== -1) {
        timestamp = line.slice(0, firstSpaceIndex);
        title = line.slice(firstSpaceIndex + 1).trim();
    }

    return {
        timestampStart: TimeUtil.secondToTimeStr(TimeUtil.parseDuration(timestamp)),
        timestampEnd: TimeUtil.secondToTimeStr(TimeUtil.parseDuration(timestamp)),
        timestampValid: true,
        title,
        original: line
    }
}

export default parseChapter;
