import axios from 'axios'

const AUTH_TOKEN_KEY = 'ncc_token'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000',
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('ncc_token')
      sessionStorage.removeItem('ncc_user')
      window.location.assign('/login')
    }

    return Promise.reject(error)
  },
)
