import axios from 'axios'

const AUTH_TOKEN_KEY = 'ncc_token'
const AUTH_EXPIRES_AT_KEY = 'ncc_session_expires_at'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000',
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY)
  const expiresAt = Number(sessionStorage.getItem(AUTH_EXPIRES_AT_KEY) ?? '0')

  if (token && expiresAt && Date.now() >= expiresAt) {
    sessionStorage.removeItem('ncc_token')
    sessionStorage.removeItem('ncc_user')
    sessionStorage.removeItem(AUTH_EXPIRES_AT_KEY)
    window.location.assign('/login')
    return config
  }

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
      sessionStorage.removeItem(AUTH_EXPIRES_AT_KEY)
      window.location.assign('/login')
    }

    return Promise.reject(error)
  },
)
