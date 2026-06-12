export function insertSorted<T>(
    arr: T[],
    element: T,
    key: (element: T) => number,
    comparator = (a: number, b: number) => a - b
) {
    let low = 0
    let high = arr.length
    const targetValue = key(element)

    while (low < high) {
        const mid = (low + high) >>> 1
        const midValue = key(arr[mid] as T)

        if (comparator(targetValue, midValue) > 0) {
            low = mid + 1
        } else {
            high = mid
        }
    }

    arr.splice(low, 0, element)
}

export function bytesToString(bytes: number): string {
    const KB = 1000
    const MB = 1000 * KB
    const GB = 1000 * MB
    if (bytes < MB) {
        return `${formatDecimal(bytes / KB)} KB`
    } else if (bytes < GB) {
        return `${formatDecimal(bytes / MB)} MB`
    } else {
        return `${formatDecimal(bytes / GB)} GB`
    }
}

function formatDecimal(num: number, fractionDigits: number = 2): string {
    return parseFloat(num.toFixed(fractionDigits)).toString()
}
