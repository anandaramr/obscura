import libSharp from "sharp"

// Avoids keeping files open unnecessarily
libSharp.cache(false)

export default libSharp