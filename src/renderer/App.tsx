import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import React, { Component } from 'react';
import icon from '../../assets/icon.svg';
import './App.css';
import FileT, { FileType } from "./lib/param/FileT";
import Player from "./components/Player";
import Subtitle from "./components/Subtitle";
import MainSubtitle from "./components/MainSubtitle";
import PlayTime from "./components/PlayTime";
import UploadPhoto from "./components/UplodeButton";
import BorderProgressBar from "./components/BorderProgressBar";
import GlobalShortCut, { JumpPosition } from "./components/GlobalShortCut";
import SentenceT from "./lib/param/SentenceT";
import RecordProgress from "./components/RecordProgress";
import './fonts/Archivo-VariableFont_wdth,wght.ttf'

interface HomeState {
  /**
   * 视频文件
   * @private
   */
  videoFile: FileT;
  /**
   * 字幕文件
   * @private
   */
  subtitleFile: FileT;
}
export default class App extends Component<any, HomeState> {
  /**
   * 当前播放时间
   * @private
   */
  private progress: number;
  /**
   * 播放器引用
   * @private
   */
  private playerRef: React.RefObject<Player>;
  /**
   * 视频时长
   * @private
   */
  private totalTime: number;
  /**
   * 侧边字幕组件引用
   * @private
   */
  private subtitleRef: React.RefObject<Subtitle>;
  /**
   * 主字幕组件引用
   * @private
   */
  private mainSubtitleRef: React.RefObject<MainSubtitle>;




  constructor(props: any) {
    super(props);
    this.progress = 0;
    this.totalTime = 0;
    this.playerRef = React.createRef<Player>();
    this.subtitleRef = React.createRef<Subtitle>();
    this.mainSubtitleRef = React.createRef<MainSubtitle>();

    this.state = {
      // @ts-ignore
      videoFile: undefined,
      // @ts-ignore
      subtitleFile: undefined,
    }
  }

  private onFileChange = (file: FileT) => {
    if (FileType.VIDEO === file.fileType) {
      this.setState({
        videoFile: file
      })
    }
    if (FileType.SUBTITLE === file.fileType) {
      this.setState({
        subtitleFile: file
      })
    }
  }

  private seekTo = (time: number) => {
    // @ts-ignore
    this.playerRef.current.seekTo(time);
    // @ts-ignore
    this.playerRef.current.play();
  }

  private onSpace() {
    // @ts-ignore
    this.playerRef.current.change();
  }

  private onJumpTo(position: JumpPosition) {
    if (this.subtitleRef.current === undefined) {
      console.log("subtitleRef is empty, can not jump")
      return;
    }
    if (JumpPosition.BEFORE === position) {
      // @ts-ignore
      this.subtitleRef.current.jumpPrev();
    }
    if (JumpPosition.AFTER === position) {
      // @ts-ignore
      this.subtitleRef.current.jumpNext();
    }
    if (JumpPosition.CURRENT === position) {
      // @ts-ignore
      this.subtitleRef.current.repeat();
    }

  }

  private changeCurrentSentence(currentSentence: SentenceT) {
    if (this.mainSubtitleRef === undefined) {
      return;
    }
    // @ts-ignore
    this.mainSubtitleRef.current.setState({
      sentence: currentSentence
    })
  }

  private showControl = () => {
    console.log("showC")
    // @ts-ignore
    this.playerRef.current.showControl();
  }
  private hideControl = () => {
    console.log("hideControl")
    // @ts-ignore
    this.playerRef.current.hideControl();
  }

  render() {
    return (
      <div className={'font-face-arc'}>
        <GlobalShortCut
          onJumpTo={(position) => this.onJumpTo(position)}
          onSpace={() => this.onSpace()}/>
        <RecordProgress getCurrentProgress={() => this.progress}
                        getCurrentVideoFile={() => this.state.videoFile}/>
        <div className='container'>
          <div
            onMouseOver={() => this.showControl()}
            onMouseLeave={() => this.hideControl()}
            className='player'
            id={"player-id"}>
            <Player
              ref={this.playerRef}
              videoFile={this.state.videoFile}
              onProgress={(time) => this.progress = time}
              onTotalTimeChange={(time) => this.totalTime = time}
            />
          </div>
          <div className='subtitle' id={"subtitle-id"}>
            <Subtitle
              ref={this.subtitleRef}
              getCurrentTime={() => this.progress}
              onCurrentSentenceChange={(currentSentence) => this.changeCurrentSentence(currentSentence)}
              seekTo={(time) => this.seekTo(time)}
              subtitleFile={this.state.subtitleFile}
            />
          </div>
          <div className={'menu'}>
            <PlayTime getTotalTime={() => this.totalTime} getProgress={() => this.progress}/>
          </div>
          <div className='underline-subtitle'>
            <MainSubtitle ref={this.mainSubtitleRef}/>
            <UploadPhoto onFileChange={this.onFileChange}/>
          </div>
        </div>
        <div id={'progressBarRef'}>
          <BorderProgressBar getCurrentTime={() => this.progress} getTotalTime={() => this.totalTime}/>
        </div>
      </div>
    )
  }
}
