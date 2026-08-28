const API_KEY = "d7a716a806a66824327f02bb6e71dc9c";
const BASE_URL = "https://api.themoviedb.org/3";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000/api";

// TMDb API functions (unchanged)
export const getPopularMovies = async (page = 1) => {
  const response = await fetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&page=${page}`);
  const data = await response.json();
  return data.results;
};

export const searchMovies = async (query) => {
  const response = await fetch(
    `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(
      query
    )}`
  );
  const data = await response.json();
  return data.results;
};

export const getMovieDetails = async (movieId) => {
  const response = await fetch(
    `${BASE_URL}/movie/${movieId}?api_key=${API_KEY}`
  );
  const data = await response.json();
  return data;
};

export const getMovieCredits = async (movieId) => {
  const response = await fetch(
    `${BASE_URL}/movie/${movieId}/credits?api_key=${API_KEY}`
  );
  const data = await response.json();
  return data;
};

export const getMovieVideos = async (movieId) => {
  const response = await fetch(
    `${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}`
  );
  const data = await response.json();
  return data;
};

export const getSimilarMovies = async (movieId) => {
  const response = await fetch(
    `${BASE_URL}/movie/${movieId}/similar?api_key=${API_KEY}`
  );
  const data = await response.json();
  return data.results;
};

// Backend API functions for authentication and favorites
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export const register = async (username, email, password) => {
  const response = await fetch(`${BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
};

export const login = async (username, password) => {
  const response = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
};

export const getUserProfile = async () => {
  const response = await fetch(`${BACKEND_URL}/auth/profile`, {
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
};

export const getUserFavorites = async () => {
  const response = await fetch(`${BACKEND_URL}/favorites`, {
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
};

export const addToFavorites = async (movieId) => {
  const response = await fetch(`${BACKEND_URL}/favorites/${movieId}`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
};

export const removeFromFavorites = async (movieId) => {
  const response = await fetch(`${BACKEND_URL}/favorites/${movieId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
};
