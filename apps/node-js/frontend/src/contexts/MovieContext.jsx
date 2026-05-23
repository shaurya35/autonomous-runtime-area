import {createContext, useState, useContext, useEffect} from "react"
import { getUserFavorites, addToFavorites as apiAddToFavorites, removeFromFavorites as apiRemoveFromFavorites } from "../services/api"

const MovieContext = createContext()

export const useMovieContext = () => useContext(MovieContext)

export const MovieProvider = ({children}) => {
    const [favorites, setFavorites] = useState([])
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    // Check for stored token on app load
    useEffect(() => {
        const token = localStorage.getItem('token')
        const storedUser = localStorage.getItem('user')

        if (token && storedUser) {
            setUser(JSON.parse(storedUser))
            loadUserFavorites()
        } else {
            setLoading(false)
        }
    }, [])

    const loadUserFavorites = async () => {
        try {
            const favIds = await getUserFavorites()
            setFavorites(favIds)
        } catch (err) {
            console.error('Failed to load favorites:', err)
            // Fallback to localStorage if API fails
            const storedFavs = localStorage.getItem("favorites")
            if (storedFavs) setFavorites(JSON.parse(storedFavs))
        } finally {
            setLoading(false)
        }
    }

    const login = (userData, token) => {
        setUser(userData)
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(userData))
        loadUserFavorites()
    }

    const logout = () => {
        setUser(null)
        setFavorites([])
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('favorites')
    }

    const addToFavorites = async (movie) => {
        if (!user) {
            // Fallback to localStorage if not logged in
            const updatedFavorites = [...favorites, movie.id]
            setFavorites(updatedFavorites)
            localStorage.setItem('favorites', JSON.stringify(updatedFavorites))
            return
        }

        try {
            await apiAddToFavorites(movie.id)
            setFavorites(prev => [...prev, movie.id])
        } catch (err) {
            console.error('Failed to add to favorites:', err)
            // Fallback to local state
            setFavorites(prev => [...prev, movie.id])
        }
    }

    const removeFromFavorites = async (movieId) => {
        if (!user) {
            // Fallback to localStorage if not logged in
            setFavorites(prev => prev.filter(id => id !== movieId))
            const updatedFavs = favorites.filter(id => id !== movieId)
            localStorage.setItem('favorites', JSON.stringify(updatedFavs))
            return
        }

        try {
            await apiRemoveFromFavorites(movieId)
            setFavorites(prev => prev.filter(id => id !== movieId))
        } catch (err) {
            console.error('Failed to remove from favorites:', err)
            // Fallback to local state
            setFavorites(prev => prev.filter(id => id !== movieId))
        }
    }

    const isFavorite = (movieId) => {
        return favorites.includes(movieId)
    }

    const value = {
        favorites,
        user,
        loading,
        login,
        logout,
        addToFavorites,
        removeFromFavorites,
        isFavorite
    }

    return <MovieContext.Provider value={value}>
        {children}
    </MovieContext.Provider>
}
