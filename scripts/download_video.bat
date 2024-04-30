@echo off
setlocal

if "%~1"=="" (
    echo Error: No library path provided.
    goto eof
)
if "%~2"=="" (
    echo Error: No video URL provided.
    goto eof
)

set "LIB_PATH=%~1"
set "VIDEO_URL=%~2"

pushd "%USERPROFILE%\Downloads" || (
    echo Failed to change directory to %USERPROFILE%\Downloads
    goto eof
)

set "PATH=%LIB_PATH%;%PATH%"

yt-dlp -S "res:1080,ext" "%VIDEO_URL%"

echo.
echo.
echo Note:
echo.
echo The video has been successfully downloaded to %USERPROFILE%\Downloads
echo Command used: yt-dlp -S "res:1080,ext" "%VIDEO_URL%"
echo Tools such as ffmpeg, ffprobe, and yt-dlp are pre-set in the current command line and can be utilized.
echo.

pause

cmd /k

popd
endlocal
