YouTube Playlist Merger
=======================

This application merges videos from a YouTube playlist into a single file, offering MP3 (audio-only) or MP4 (video) output options.

Features:
- Merge YouTube playlist videos into one file
- MP3 and MP4 output formats
- Customizable video resolution for MP4
- Web-based user interface
- Server-side processing with Node.js

How It Works:
1. User Interface (index.html):
   - Enter YouTube playlist URL
   - Select output format (MP3/MP4)
   - Choose video resolution (MP4 only)

2. Server Processing (server.js):
   - Handles requests from web interface
   - Downloads videos from playlist
   - Merges videos into single file
   - Provides download link for merged file

Key Components:
- downloadVideo: Downloads individual videos
- mergeVideos: Combines videos using FFmpeg
- processPlaylist: Manages downloading and merging

Technical Stack:
- Frontend: HTML, JavaScript, Tailwind CSS
- Backend: Node.js, Express.js
- Dependencies: youtube-dl-exec, ffmpeg (separate installation)

Setup and Usage:
1. Install Node.js and FFmpeg
2. Clone repo and run: npm install
3. Start server: npm start
4. Open browser: http://localhost:3000
5. Enter playlist URL, select options, click "Merge Playlist"
6. Wait for completion, then download merged file

Important Notes:
- Built-in timeouts prevent long-running processes
- Temporary files created and cleaned up
- Error handling for various scenarios

Limitations:
- Processing time varies with playlist size
- Large playlists may take significant time
- Relies on third-party tools (youtube-dl, FFmpeg)

Code Structure:
- server.js: Main server logic and processing
- public/index.html: Web interface

This application provides a user-friendly way to merge YouTube playlist videos, handling the complexities of video downloading and merging on the server-side while offering a simple web interface for user interaction.