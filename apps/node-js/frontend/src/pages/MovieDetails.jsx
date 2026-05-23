import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getMovieDetails, getMovieCredits, getMovieVideos, getSimilarMovies } from "../services/api";
import MovieCard from "../components/MovieCard";
import "../css/MovieDetails.css";

function MovieDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [movie, setMovie] = useState(location.state?.movie || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [credits, setCredits] = useState(null);
  const [cast, setCast] = useState([]);
  const [director, setDirector] = useState(null);
  const [trailerKey, setTrailerKey] = useState(null);
  const [similarMovies, setSimilarMovies] = useState([]);

  useEffect(() => {
    const loadMovieData = async () => {
      setLoading(true);
      try {
        const [details, creditsData, videos, similar] = await Promise.all([
          movie && movie.id?.toString() === id ? Promise.resolve(movie) : getMovieDetails(id),
          getMovieCredits(id),
          getMovieVideos(id),
          getSimilarMovies(id),
        ]);

        setMovie(details);
        setCredits(creditsData);

        const topCast = creditsData.cast?.slice(0, 6) || [];
        setCast(topCast);

        const movieDirector = creditsData.crew?.find((member) => member.job === "Director") || null;
        setDirector(movieDirector);

        const trailer = videos.results?.find(
          (video) => video.site === "YouTube" && video.type === "Trailer"
        );
        setTrailerKey(trailer?.key || null);

        setSimilarMovies((similar || []).filter((item) => item.poster_path).slice(0, 6));
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to load movie details.");
      } finally {
        setLoading(false);
      }
    };

    loadMovieData();
  }, [id]);

  const handleBack = () => {
    if (location.state?.from) {
      navigate(-1);
    } else {
      navigate("/home");
    }
  };

  const handleWatchTrailer = () => {
    if (trailerKey) {
      window.open(`https://www.youtube.com/watch?v=${trailerKey}`, "_blank");
    }
  };

  if (loading) {
    return <div className="movie-details-loading">Loading movie details...</div>;
  }

  if (error) {
    return <div className="movie-details-error">{error}</div>;
  }

  if (!movie) {
    return null;
  }

  const genreList = movie.genres?.map((genre) => genre.name).join(", ");
  const writerNames = credits?.crew
    ?.filter((member) => ["Writer", "Screenplay", "Story"].includes(member.job))
    .map((member) => member.name)
    .filter(Boolean);

  const formattedRuntime = movie.runtime
    ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`
    : null;

  return (
    <div className="movie-details-page">
      <button className="details-back-button" onClick={handleBack}>
        ← Back
      </button>

      <div className="movie-details-card">
        <div className="details-poster">
          <img
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
          />
        </div>
        <div className="details-content">
          <div className="details-header">
            <div>
              <h1>{movie.title}</h1>
              {movie.tagline && <p className="details-tagline">{movie.tagline}</p>}
            </div>
            {trailerKey && (
              <button className="details-trailer-button" onClick={handleWatchTrailer}>
                Watch Trailer
              </button>
            )}
          </div>

          <div className="details-meta">
            <span>{movie.release_date}</span>
            {formattedRuntime && <span>{formattedRuntime}</span>}
            {movie.vote_average !== undefined && (
              <span>Rating: {movie.vote_average.toFixed(1)}</span>
            )}
          </div>
          {genreList && <div className="details-genres">{genreList}</div>}

          <div className="details-extra">
            {director && (
              <p>
                <strong>Director:</strong> {director.name}
              </p>
            )}
            {writerNames?.length > 0 && (
              <p>
                <strong>Writer:</strong> {writerNames.join(", ")}
              </p>
            )}
            {movie.original_language && (
              <p>
                <strong>Language:</strong> {movie.original_language.toUpperCase()}
              </p>
            )}
            {movie.popularity && (
              <p>
                <strong>Popularity:</strong> {movie.popularity.toFixed(1)}</p>
            )}
          </div>

          <p className="details-overview">{movie.overview}</p>

          <div className="details-additional">
            {movie.status && (
              <div>
                <strong>Status:</strong> {movie.status}
              </div>
            )}
            {movie.budget > 0 && (
              <div>
                <strong>Budget:</strong> ${movie.budget.toLocaleString()}
              </div>
            )}
            {movie.revenue > 0 && (
              <div>
                <strong>Revenue:</strong> ${movie.revenue.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {cast.length > 0 && (
        <div className="details-cast-section">
          <h2>Top Cast</h2>
          <div className="details-cast-list">
            {cast.map((actor) => (
              <div className="cast-item" key={actor.cast_id || actor.credit_id}>
                <img
                  src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                  alt={actor.name}
                />
                <p className="cast-name">{actor.name}</p>
                <p className="cast-role">as {actor.character}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {similarMovies.length > 0 && (
        <div className="details-similar-section">
          <h2>Similar Movies</h2>
          <div className="similar-movies-grid">
            {similarMovies.map((similarMovie) => (
              <MovieCard movie={similarMovie} key={similarMovie.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MovieDetails;
