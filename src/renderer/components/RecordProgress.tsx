import { Component, useEffect, useRef } from 'react';
import axios from 'axios';
import FileT from '../lib/param/FileT';

interface RecordProgressParam {
  getCurrentProgress: () => number;
  getCurrentVideoFile: () => FileT;
}

const RecordProgress = (props: RecordProgressParam) => {
  useEffect(() => {
    const { getCurrentVideoFile, getCurrentProgress } = props;
    function method() {
      if (
        getCurrentVideoFile() === undefined ||
        getCurrentProgress() === undefined
      ) {
        return;
      }
      console.log('update progress');
      const { fileName } = getCurrentVideoFile();
      const progress = getCurrentProgress();
      console.log('recordProgress', fileName, progress);
      // axios.get('/api/updateProgress', {
      //   params: {
      //     fileName,
      //     progress,
      //   },
      // });
    }

    const interval = setInterval(method, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [props]);
  return <></>;
};
export default RecordProgress;
