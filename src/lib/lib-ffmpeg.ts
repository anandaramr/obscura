let ffmpegPath: string | null = null

export async function getFfmpegPath(): Promise<string> {
    if (ffmpegPath) return ffmpegPath

    try {
        const ffmpeg = await import("ffmpeg-static")
        ffmpegPath = typeof ffmpeg === "string" ? ffmpeg : (ffmpeg as any).default
        return ffmpegPath as string
    } catch (e: any) {
        if (e.code === "ERR_MODULE_NOT_FOUND") {
            throw new Error("ffmpeg was not installed as a dependency")
        } else {
            throw e
        }
    }
}
