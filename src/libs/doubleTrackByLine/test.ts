import { doubleTrackByLine } from './doubleTrackByLine'

const testLine = [ [0, 0, 0], [0, 0, -1], [1, 0, -1] ]

const result = doubleTrackByLine(testLine, 0.2)
console.log(testLine, result)
