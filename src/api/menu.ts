export function getRoutes(): Promise<IOriginRoute[]> {
  return new Promise((resolve, reject) => {
    fetch('/dataset/router.json')
      .then((res) => res.json())
      .then((data) => {
        resolve(data)
      })
      .catch((error) => reject(error))
  })
}
