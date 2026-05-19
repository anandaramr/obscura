function insertSorted(arr, element, key, comparator = (a, b) => a - b) {
    let low = 0
    let high = arr.length
    const targetValue = key(element)

    while (low < high) {
        const mid = (low + high) >>> 1
        const midValue = key(arr[mid])

        if (comparator(targetValue, midValue) > 0) {
            low = mid + 1
        } else {
            high = mid
        }
    }

    arr.splice(low, 0, element)
}

module.exports = { insertSorted }