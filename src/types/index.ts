// Common TypeScript types for your application

export interface User {
  id: string
  name: string
  email: string
}

export interface ApiResponse<T> {
  data: T
  message: string
  success: boolean
}

export type Theme = 'light' | 'dark'

export interface AppConfig {
  apiUrl: string
  theme: Theme
}