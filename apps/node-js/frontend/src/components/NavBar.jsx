import "../css/NavBar.css";
import { Link } from "react-router-dom";
import { useMovieContext } from "../contexts/MovieContext";

function NavBar(){
    const { user, logout } = useMovieContext();

    const handleLogout = () => {
        logout();
    };

    return(
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/home">Movie Box</Link>
            </div>
            <div className="navbar-links">
                <Link to="/favorites" className="nav-link">Favorites</Link>
                {user ? (
                    <div className="user-menu">
                        <span className="user-greeting">Hello, {user.username}</span>
                        <button onClick={handleLogout} className="logout-btn">Logout</button>
                    </div>
                ) : (
                    <Link to="/login" className="nav-link">Login</Link>
                )}
            </div>
        </nav>
    );
}

export default NavBar
