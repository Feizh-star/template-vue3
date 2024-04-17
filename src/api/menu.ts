export function getRoutes(): Promise<IOriginRoute[]> {
  return new Promise((resolve, reject) => {
    fetch((import.meta.env.DEV ? '/' : import.meta.env.VITE_APP_BASE_URL) + 'dataset/router.json')
      .then((res) => res.json())
      .then((data) => {
        resolve(data)
      })
      .catch((error) => reject(error))
  })
}
