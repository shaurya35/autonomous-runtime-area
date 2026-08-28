import "../css/Favorites.css";
import { useMovieContext } from "../contexts/MovieContext";
import MovieCard from "../components/MovieCard";
import { useState, useEffect } from "react";
import { getMovieDetails } from "../services/api";

function Favorites() {
  const { favorites, user } = useMovieContext();
  const [favoriteMovies, setFavoriteMovies] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadFavoriteMovies = async () => {
      if (favorites.length === 0) {
        setFavoriteMovies([]);
        return;
      }

      setLoading(true);
      try {
        const moviePromises = favorites.map(id => getMovieDetails(id));
        const movies = await Promise.all(moviePromises);
        setFavoriteMovies(movies);
      } catch (err) {
        console.error('Failed to load favorite movies:', err);
        setFavoriteMovies([]);
      } finally {
        setLoading(false);
      }
    };

    loadFavoriteMovies();
  }, [favorites]);

  const movieCards = favoriteMovies.map((movie) => (
    <MovieCard movie={movie} key={movie.id} />
  ));

  if (loading) {
    return (
      <div className="favorites">
        <h2>Your Favorites</h2>
        <div>Loading your favorite movies...</div>
      </div>
    );
  }

  return (
    <div className="favorites">
      <h2>Your Favorites</h2>
      {favorites.length > 0 ? (
        <div className="movies-grid">
          {movieCards}
        </div>
      ) : (
        <div className="favorites-empty">
          <h2>No Favorite Movies Yet</h2>
          <p>Start adding movies to your favorites and they will appear here!</p>
          {!user && <p><a href="/login">Login</a> to sync your favorites across devices.</p>}
        </div>
      )}
    </div>
  );
}

export default Favorites;
