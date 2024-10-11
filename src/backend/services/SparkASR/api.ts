// api.ts
import axios, { CancelTokenSource } from 'axios';
import fs from "fs";
import { generateSigna } from './auth';
import { GetResultRequest, GetResultResponse, UploadRequest, UploadResponse } from './types';
const BASE_URL = 'https://raasr.xfyun.cn/v2/api';
 

export async function uploadFile(request: UploadRequest , filePath:string, appId: string, secretKey: string): Promise<UploadResponse> {
    const ts = Math.floor(Date.now() / 1000);
    const signa = generateSigna(appId, secretKey, ts);
    const readStream = fs.createReadStream(filePath);
    const url = `${BASE_URL}/upload`;
    //?signa=${signa}&appId=${appId}&ts=${ts}
    const searchParams = new URLSearchParams();
    searchParams.append('signa', signa);
    searchParams.append('appId', appId);
    searchParams.append('ts', ts+"");
    Object.keys(request).forEach(key => {
        searchParams.append(key, request[key as 'fileName']);
    });
    /* const response = await fetchWithErrorHandling(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
        },
        body: readStream
    }); */
    const resp = await axios.post(url+"?" + searchParams.toString(),readStream,{
        headers: {
            'Content-Type': 'application/octet-stream',
        }
    })
    return resp.data;
}

export async function getResult(request: GetResultRequest, appId: string, secretKey: string , cancelTokenSource:CancelTokenSource): Promise<GetResultResponse> {
    const ts = Math.floor(Date.now() / 1000);
    const signa = generateSigna(appId, secretKey, ts);
    const url = `${BASE_URL}/getResult`;
    const searchParams = new URLSearchParams();
    searchParams.append('signa', signa);
    searchParams.append('appId', appId);
    searchParams.append('ts', ts+"");
    searchParams.append('orderId', request.orderId);
    const response = await axios.get(url+"?" + searchParams.toString(), { 
        cancelToken: cancelTokenSource.token,
    });
    return response.data;
}


export function delay(time:number){
    return new Promise(resolve => setTimeout(resolve, time));
}