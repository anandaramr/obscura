const morgan = require('morgan')

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
}

morgan.token('colored-method', (req) => {
  const method = req.method
  const color = {
    GET: colors.green,
    POST: colors.cyan,
    PUT: colors.yellow,
    PATCH: colors.yellow,
    DELETE: colors.red,
  }[method] || colors.reset
  return `${color}${method}${colors.reset}`
})

morgan.token('colored-status', (req, res) => {
  const status = res.statusCode
  const color = status >= 500 ? colors.red
    : status >= 400 ? colors.yellow
    : status >= 300 ? colors.cyan
    : colors.green
  return `${color}${status}${colors.reset}`
})

morgan.token('client-ip', (req) => {
  return `${colors.gray}${req.headers['x-forwarded-for'] || req.socket.remoteAddress}${colors.reset}`
})

morgan.token('device', (req) => {
  const ua = req.headers['user-agent'] || ''
  const name = ua.includes('Android') ? 'Android'
    : ua.includes('iPhone') ? 'iPhone'
    : ua.includes('Windows') ? 'Windows'
    : ua.includes('Macintosh') ? 'Mac'
    : ua.includes('Linux') ? 'Linux'
    : 'Unknown'
  return name
})

module.exports = () => morgan(':colored-method :url :colored-status :response-time ms — :client-ip [:device]')