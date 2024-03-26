import axios from 'axios'

const temporaryToken =
  'Bearer eyJhbGciOiJIUzUxMiJ9.eyJsb2dpbl91c2VyX2tleSI6ImI2NzMwZmQxLTI2NTMtNDY0Yy1iZGIxLWM5NTVjZTc2MDcyYiJ9.6ODy3IawNBnIBQ89JrEFcyWk50BdYrCFnG_2mvc3DwrFofasyEVQfVQcWULpRUm0TO8HP52CuVsLNgUbg7VIgg'

export function getJobStatusDict() {
  return axios
    .get('/api/system/dict/data/type/sys_normal_disable', {
      headers: {
        Authorization: temporaryToken,
      },
    })
    .then((axiosRes) => {
      return axiosRes.data
    })
}

export function getJobList(params) {
  return axios
    .get('/api/system/post/list', {
      headers: {
        Authorization: temporaryToken,
      },
      params: {
        ...params,
      },
    })
    .then((axiosRes) => {
      return axiosRes.data
    })
}

export function addJob(data) {
  return axios
    .post('/api/system/post', data, {
      headers: {
        Authorization: temporaryToken,
      },
    })
    .then((axiosRes) => {
      return axiosRes.data
    })
}

export function updateJob(data) {
  return axios
    .put('/api/system/post', data, {
      headers: {
        Authorization: temporaryToken,
      },
    })
    .then((axiosRes) => {
      return axiosRes.data
    })
}

export function deleteJob(jobId) {
  return axios
    .delete('/api/system/post/' + jobId, {
      headers: {
        Authorization: temporaryToken,
      },
    })
    .then((axiosRes) => {
      return axiosRes.data
    })
}
