export function filterAttrbuteByKeys<T extends Record<any, any>>(
  obj: Record<any, any>,
  arr: any[]
) {
  const newObj: any = {}
  for (const key of arr) {
    if (obj[key] === undefined) continue
    newObj[key] = obj[key]
  }
  return newObj as T
}
