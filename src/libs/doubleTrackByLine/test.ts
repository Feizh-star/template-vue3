import { doubleTrackByLine } from './doubleTrackByLine'

const testLine = [ [0, 0, 0], [0, 2, 0], [2, 2, 0], [2, 3, 0] ]

const result = doubleTrackByLine(testLine, { distance: 1, straightNormal: [0, 0, 1] })
console.log(testLine, result)
