import axios from 'axios';
import fs from 'fs';

const url = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffprobe-darwin-arm64';

const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
});

const dir = path.join(process.cwd(), 'lib');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}
const p = `${dir}/ffprobe`;
const writer = fs.createWriteStream(p);
await response.data.pipe(writer);
fs.chmodSync(p, 0o755);
