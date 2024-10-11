// index.ts
import { CancelTokenSource } from "axios";
import fs from "fs";
import { delay, getResult, uploadFile } from "./api";
import { GetResultResponse, OrderResult } from "./types";

export * from "./types";

function getFileSize(filePath: string) {
    const stats = fs.statSync(filePath);
    return stats.size;
}
function reduceByKey<T>(arr: T[], key: keyof T) {
    return arr.reduce((pre, item) => {
        const keyValue = item[key];
        return (pre + keyValue) as string;
    }, "");
}

function transformResp(resultResponse: GetResultResponse) {
    const orderResult = resultResponse.content?.orderResult;
    if (!orderResult) {
        throw new Error("获取结果失败");
    }
    const result = JSON.parse(orderResult) as OrderResult;

    const segments = result.lattice2?.map((item) => {
        const text = item.json_1best.st.rt.reduce((stPre, stItem) => {
            return (
                stPre +
                stItem.ws.reduce((wsPre, wsItem) => {
                    return wsPre + reduceByKey(wsItem.cw, "w");
                }, "")
            );
        }, "");
        return {
            seek: 0,
            text,
            start: Number(item.begin)/1000,
            end: Number(item.end)/1000,
        };
    });

    const res = {
        language: "zh",
        duration: segments[segments.length - 1]?.end ?? 0,
        text: segments.map((item) => item.text).join(""),
        segments,
    };
    return res;
}

/**
 * 使用科大讯飞语音转录进行语音识别
 * @link 文档 https://www.xfyun.cn/doc/asr/ifasr_new/API.html#_2%E3%80%81%E6%9F%A5%E8%AF%A2%E7%BB%93%E6%9E%9C
 * @param filePath
 */
export async function sparkASRRequest(
    filePath: string,
    appId: string,
    secretKey: string,
    cancelToken?:CancelTokenSource

) {
    const fileSize = await getFileSize(filePath);
    const fileName = filePath.split("/").pop();
    const uploadResponse = await uploadFile(
        {
            fileName,
            fileSize: fileSize,
            duration: 60,
            audioMode: "fileStream",
            language:"en"
        },
        filePath,
        appId,
        secretKey
    );

    if (uploadResponse.code !== "000000") {
        throw new Error("上传失败:" + uploadResponse.descInfo);
    }
    await delay(3000);

    let resultResponse = await getResult(
        {
            orderId: uploadResponse.content.orderId,
        },
        appId,
        secretKey,
        cancelToken
    );
    let status = resultResponse.content?.orderInfo?.status;
    while (status == 3) {
        resultResponse = await getResult(
            {
                orderId: uploadResponse.content.orderId,
            },
            appId,
            secretKey,
            cancelToken
        );
        status = resultResponse.content?.orderInfo?.status;
        await delay(1000);
    }
    return transformResp(resultResponse);
}
