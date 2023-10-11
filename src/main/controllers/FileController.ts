import fs from 'fs';

const openFile = async (path: string): Promise<any> => {
    // 打开文件, 返回文件流
    return new Promise((resolve, reject) => {
        fs.open(path, 'r', (err, fd) => {
            if (err) {
                reject(err);
            }
            resolve(fd);
        });
    });
};
