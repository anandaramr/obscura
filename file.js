const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic']
const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm']

function scanDir(dir, filesMap = new Map()) {
    let results = []

    const absolutePath = path.resolve(process.cwd(), dir)
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Directory does not exist: "${absolutePath}"`)
    }
    
    const stats = fs.statSync(absolutePath)
    if (!stats.isDirectory()) {
        throw new Error(`Path is a file, not a directory: "${absolutePath}"`)
    }
    
    const entries = fs.readdirSync(absolutePath, { withFileTypes: true })

    for (const entry of entries) {
        const fullPath = path.join(absolutePath, entry.name)

        if (entry.isDirectory()) {
            scanDir(fullPath, filesMap)
        } else {
            const ext = path.extname(entry.name).toLowerCase()
            if ([ ...IMAGE_EXTS, ...VIDEO_EXTS ].includes(ext)) {
                const stat = fs.statSync(fullPath)
                results.push({
                    id: crypto.createHash('md5').update(fullPath).digest('hex'),
                    name: entry.name,
                    path: fullPath,
                    type: IMAGE_EXTS.includes(ext) ? 'image' : 'video',
                    date: stat.mtime,
                    size: stat.size
                })
            }
        }
    }

    for (const file of results) {
        filesMap.set(file.id, file)
    }
    return filesMap
}

module.exports = { scanDir }