import "../css/Login.css";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useMovieContext } from "../contexts/MovieContext";
import { login as apiLogin } from "../services/api";

function Login() {
  const navigate = useNavigate();
  const { login } = useMovieContext();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiLogin(formData.username, formData.password);
      login(response.user, response.token);
      navigate("/home");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-welcome">
        <h1><span className="typewriter">Welcome to Movie Box</span></h1>
        <p><span className="typewriter typewriter-secondary">Discover and save your favorite movies in one place</span></p>
      </div>

      <div className="login-container">
        <div className="login-form">
          <h2>Login</h2>
          {error && <div className="error-message" style={{color: 'red', marginBottom: '10px'}}>{error}</div>}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="signup-link">
            <p>Don't have an account? <a href="/signup">Sign up here</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
