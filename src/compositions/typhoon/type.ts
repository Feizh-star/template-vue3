export interface ITyphoonPoint {
  numNati: string
  numInati: string
  typhName: string
  typhGrade: string
  bulCenter: string
  bulCenterCode: string
  dataTime: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
  fcstHour: number
  lat: number
  lon: number
  prs: number
  winSGustMax: number
  winSContiMax: number
  wingA7Bear1: string
  radiuBear1WingA7: number
  wingA7Bear2: string
  radiuBear2WingA7: number
  wingA7Bear3: string
  radiuBear3WingA7: number
  wingA7Bear4: string
  radiuBear4WingA7: number
  wingA10Bear1: string
  radiuBear1WingA10: number
  wingA10Bear2: string
  radiuBear2WingA10: number
  wingA10Bear3: string
  radiuBear3WingA10: number
  wingA10Bear4: string
  radiuBear4WingA10: number
  wingA12Bear1: string
  radiuBear1WingA12: number
  wingA12Bear2: string
  radiuBear2WingA12: number
  wingA12Bear3: string
  radiuBear3WingA12: number
  wingA12Bear4: string
  radiuBear4WingA12: number
  modirFuture: number
  mospeedFutrue: number
  typhIntsy: number
  trendFutrue: number
}

export interface ITyphoonData {
  typh_fcstdata: ITyphoonPoint[]
  typh_skdata: ITyphoonPoint[]
}
