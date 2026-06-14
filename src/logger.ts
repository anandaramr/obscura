import morgan from "morgan"
import type { IncomingMessage, ServerResponse } from "http"

const colours = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    gray: "\x1b[90m"
} as const

type Colour = (typeof colours)[keyof typeof colours]
const methodColours: { [key: string]: Colour } = {
    GET: colours.green,
    POST: colours.cyan,
    PUT: colours.yellow,
    PATCH: colours.yellow,
    DELETE: colours.red
}
morgan.token("coloured-method", req => {
    const method = req.method
    const color = method ? methodColours[method] : colours.reset
    return `${color}${method}${colours.reset}`
})

morgan.token("coloured-status", (_, res) => {
    const status = res.statusCode
    const colour =
        status >= 500
            ? colours.red
            : status >= 400
              ? colours.yellow
              : status >= 300
                ? colours.cyan
                : colours.green
    return `${colour}${status}${colours.reset}`
})

morgan.token("client-ip", req => {
    return `${colours.gray}${req.headers["x-forwarded-for"] || req.socket.remoteAddress}${colours.reset}`
})

morgan.token("device", req => {
    const ua = req.headers["user-agent"]
    if (!ua) return "Unknown"

    const name = ua.includes("Android")
        ? "Android"
        : ua.includes("iPhone")
          ? "iPhone"
          : ua.includes("iPad")
            ? "iPad"
            : ua.includes("Windows")
              ? "Windows"
              : ua.includes("Macintosh")
                ? "Mac"
                : ua.includes("Linux")
                  ? "Linux"
                  : "Unknown"
    return name
})

export default (
    skip: (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => boolean = () => false
) => {
    return morgan(
        "[:date[web]] :coloured-method :url :coloured-status :response-time ms — :client-ip (:device)",
        { skip }
    )
}
