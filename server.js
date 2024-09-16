const express = require('express');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));
app.use('/downloads', express.static('downloads'));

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadVideo(url, outputPath, format, resolution) {
    console.log(`Downloading: ${url} to ${outputPath}`);
    const options = {
        output: outputPath,
        format: format === 'mp3' ? 'bestaudio/best' : `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]`,
    };

    if (format === 'mp3') {
        options.extractAudio = true;
        options.audioFormat = 'mp3';
    } else if (format === 'mp4') {
        options.mergeOutputFormat = 'mp4';
    }

    try {
        await youtubedl(url, options);
        console.log(`Download completed: ${outputPath}`);
        
        const stats = await fs.stat(outputPath);
        if (stats.size === 0) {
            console.error(`Downloaded file is empty: ${outputPath}`);
            return null;
        }
        console.log(`File size: ${stats.size} bytes`);
        return outputPath;
    } catch (error) {
        console.error(`Error downloading ${url}:`, error);
        return null;
    }
}

async function mergeVideos(inputFiles, outputFile) {
    console.log('Starting merge process...');
    const fileList = inputFiles.map(file => `file '${file}'`).join('\n');
    const fileListPath = path.join(__dirname, 'filelist.txt');
    await fs.writeFile(fileListPath, fileList);
    console.log('File list created:', fileListPath);

    const command = 'ffmpeg';
    const args = [
        '-f', 'concat',
        '-safe', '0',
        '-i', fileListPath,
        '-c', 'copy',
        outputFile
    ];
    console.log('Executing command:', command, args.join(' '));

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(command, args);
        let stdoutData = '';
        let stderrData = '';

        ffmpeg.stdout.on('data', (data) => {
            stdoutData += data.toString();
            console.log('FFmpeg stdout:', data.toString());
        });

        ffmpeg.stderr.on('data', (data) => {
            stderrData += data.toString();
            console.error('FFmpeg stderr:', data.toString());
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log('FFmpeg process completed successfully');
                fs.unlink(fileListPath)
                    .then(() => {
                        console.log('Merge completed successfully');
                        resolve(outputFile);
                    })
                    .catch(err => {
                        console.error('Error deleting file list:', err);
                        resolve(outputFile);
                    });
            } else {
                console.error(`FFmpeg process exited with code ${code}`);
                reject(new Error(`FFmpeg process failed: ${stderrData}`));
            }
        });

        ffmpeg.on('error', (err) => {
            console.error('FFmpeg process error:', err);
            reject(err);
        });
    });
}

async function processPlaylist(playlistUrl, format, resolution) {
    try {
        console.log(`Processing playlist: ${playlistUrl}`);
        const { entries, title } = await youtubedl(playlistUrl, {
            dumpSingleJson: true,
            flatPlaylist: true,
        });

        console.log(`Playlist title: ${title}`);
        console.log(`Number of videos: ${entries.length}`);

        const downloadPromises = entries.map((entry, index) =>
            downloadVideo(entry.url, path.join(__dirname, `temp_${index + 1}.${format}`), format, resolution)
        );

        const downloadedFiles = await Promise.all(downloadPromises);
        console.log('Downloaded files:', downloadedFiles);

        // Add a delay to ensure files are fully written
        await new Promise(resolve => setTimeout(resolve, 5000));

        const existingFiles = await Promise.all(downloadedFiles.map(async (file) => {
            if (!file) return null;
            try {
                await fs.access(file, fs.constants.F_OK);
                const stats = await fs.stat(file);
                console.log(`File exists: ${file}, Size: ${stats.size} bytes`);
                return file;
            } catch (error) {
                console.error(`File does not exist or cannot be accessed: ${file}`, error);
                return null;
            }
        }));

        const validFiles = existingFiles.filter(file => file !== null);
        console.log('Valid files:', validFiles);

        if (validFiles.length === 0) {
            throw new Error('No files were successfully downloaded');
        }

        const mergedFileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format}`;
        const mergedFilePath = path.join(__dirname, 'public', 'downloads', mergedFileName);
        console.log('Merging files to:', mergedFilePath);

        const mergeTimeout = 300000; // 5 minutes
        const mergePromise = mergeVideos(validFiles, mergedFilePath);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Merge process timed out')), mergeTimeout)
        );
        await Promise.race([mergePromise, timeoutPromise]);
        console.log('Merge process completed');

        // Clean up temporary files
        for (const file of validFiles) {
            try {
                await fs.unlink(file);
                console.log(`Deleted temporary file: ${file}`);
            } catch (error) {
                console.error(`Error deleting temporary file ${file}:`, error);
            }
        }

        console.log('Checking merged file...');
        const stats = await fs.stat(mergedFilePath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`Merged file size: ${fileSizeInMB} MB`);

        console.log('Preparing result...');
        const result = {
            downloadUrl: `/downloads/${path.basename(mergedFilePath)}`,
            fileSize: fileSizeInMB
        };
        console.log('Result prepared:', result);

        return result;
    } catch (error) {
        console.error('Error processing playlist:', error);
        throw error;
    } finally {
        console.log('Playlist processing completed');
    }
}

app.post('/merge', async (req, res) => {
    try {
        const { playlistUrl, format, resolution } = req.body;
        console.log('Received request:', { playlistUrl, format, resolution });
        
        const timeout = 600000; // 10 minutes in milliseconds
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Process timed out')), timeout)
        );

        const resultPromise = processPlaylist(playlistUrl, format, resolution);
        const result = await Promise.race([resultPromise, timeoutPromise]);
        
        console.log('Sending response:', result);
        res.json(result);
    } catch (error) {
        console.error('Error in /merge endpoint:', error);
        res.status(500).json({ error: error.message });
    } finally {
        console.log('Merge request completed');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});