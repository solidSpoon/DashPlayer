#!/bin/bash

# Check if the required parameters are passed
if [ -z "$1" ]; then
    echo "Error: No library path provided."
    exit 1
fi

if [ -z "$2" ]; then
    echo "Error: No video URL provided."
    exit 1
fi

LIB_PATH=$1
VIDEO_URL=$2

# Change directory to Downloads or exit if it fails
cd "$HOME/Downloads" || { echo "Failed to change directory to $HOME/Downloads"; exit 1; }

# Update PATH to include the library path
export PATH="$LIB_PATH:$PATH"

# Download the video using yt-dlp
yt-dlp -S "res:1080,ext" "$VIDEO_URL"

# Keep the terminal open (comment this out if you run from a terminal and want the script to exit after download)
read -p "Press [Enter] key to continue..."

