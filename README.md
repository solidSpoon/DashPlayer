<img src="https://user-images.githubusercontent.com/39454841/208255692-ea202258-747b-4a77-9090-ece503efcd0c.png" width="30%" />

# Dash Player
> A player for English learners

<img width="1498" alt="image" src="https://user-images.githubusercontent.com/39454841/206864129-58e298dc-4bba-46ee-b5ec-b9f229894e52.png">

- 支持按字幕跳转
- 支持机器翻译
- Mac 下支持 [Bob](https://bobtranslate.com/) 查词
- 可调整界面尺寸
- 支持记录播放位置


## usage:

- 点击 “+” 选择一个视频文件和一个 srt 格式的字幕文件 
- 要启用机器翻译，请在设置中配置腾讯云的 API 密钥


## Install

Clone the repo and install dependencies:

```bash
git clone --depth 1 --branch main https://github.com/solidSpoon/DashPlayer.git
cd DashPlayer
npm install
```

**Having issues installing? See our [debugging guide](https://github.com/electron-react-boilerplate/electron-react-boilerplate/issues/400)**

## Starting Development

Start the app in the `dev` environment:

```bash
npm start
```

## Packaging for Production

To package apps for the local platform:

```bash
npm run package
```

