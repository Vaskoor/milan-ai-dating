import { createContext, useState, useEffect, ReactNode } from 'react'
import { User, AuthContextType, RegisterData } from '../types'
import api from '../services/api'

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for stored token and validate
    const token = localStorage.getItem('token')
    if (token) {
      fetchUser()
    } else {
      setIsLoading(false)
    }
  }, [])

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data)
    } catch (error) {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)

    const response = await api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    const { access_token, refresh_token } = response.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('refreshToken', refresh_token)

    await fetchUser()
  }

  const register = async (data: RegisterData) => {
    const response = await api.post('/auth/register', data)
    const { access_token, refresh_token } = response.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('refreshToken', refresh_token)
    await fetchUser()
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
