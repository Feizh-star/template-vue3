type ICommonResponse<T> = Promise<{
  code: string
  data: T
  msg?: string
}>

type ICommonResponseData<T extends (...args: any[]) => any> = ReturnType<T> extends ICommonResponse<
  infer R
>
  ? R
  : any
