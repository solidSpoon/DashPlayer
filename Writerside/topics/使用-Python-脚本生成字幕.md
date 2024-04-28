# 使用 Python 脚本生成字幕

Whisper 字幕的时间戳可能不够准确，这会导致字幕和视频不同步。 但是 Python 社区给出了解决方案。您可以使用 Python 脚本来生成字幕，这样可以更加精确地生成时间戳。

具体操作详见 [stable-ts](https://github.com/jianfch/stable-ts)。

这里给出我用的 Python 脚本，运行时会弹出文件选择对话框，您选择一个视频，稍后字幕文件会生成视频所在目录。

```python
import tkinter as tk
from tkinter import filedialog
import stable_whisper
import os


def select_file():
    root = tk.Tk()
    root.withdraw()  # Hide the main window
    file_path = filedialog.askopenfilename()  # Open the file dialog
    return file_path


audio_file = select_file()  # Select the audio file

# normal
model = stable_whisper.load_model('base')
result = model.transcribe(audio_file)

# faster whisper
# model = stable_whisper.load_faster_whisper('base', compute_type="int8")
# result = model.transcribe_stable(audio_file)

# Get the directory and filename without extension
dir_name = os.path.dirname(audio_file)
base_name = os.path.basename(audio_file)
file_name_without_ext = os.path.splitext(base_name)[0]

# Create the srt file path
srt_file_path = os.path.join(dir_name, file_name_without_ext + '.srt')

result.to_srt_vtt(srt_file_path, word_level=False)
```
