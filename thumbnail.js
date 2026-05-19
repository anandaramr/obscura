const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const sharp = require("sharp");

function generateVideoThumbnail(file, thumbPath, thumbSize) {
    return new Promise((resolve, reject) => {
        execFile(
            ffmpegPath,
            [
                "-i",
                file.path,
                "-frames:v",
                "1",
                "-vf",
                `scale=${thumbSize}:${thumbSize}:force_original_aspect_ratio=increase,crop=${thumbSize}:${thumbSize}:(iw-${thumbSize})/2:(ih-${thumbSize})/2`,
                "-q:v",
                "2",
                thumbPath,
            ],
            (err) => {
                if (err) {
                    return reject(new Error(`ffmpeg error: ${err.message}`))
                }
                resolve()
            }
        )
    })
}

async function generateImageThumbnail(file, thumbPath, thumbSize) {
    await sharp(file.path, { animated: false, page: 0 })
        .resize(thumbSize, thumbSize, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toFile(thumbPath)
}

module.exports = { generateVideoThumbnail, generateImageThumbnail }