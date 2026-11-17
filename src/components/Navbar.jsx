
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <header className={`site-header ${scrolled ? "scrolled" : ""}`}>

      <nav className="premium-navbar">

        {/* BRAND LOGO */}
        <a href="#home" className="brand" onClick={closeMenu}>
          <div className="brand-icon">🎓</div>

          <div className="brand-text">
            <h2>Attendify</h2>
            <small>CAMPUS MANAGEMENT</small>
          </div>
        </a>

        {/* NAVIGATION LINKS */}
        <ul
          id="premium-menu"
          className={`premium-links ${menuOpen ? "show" : ""}`}
        >
          <li>
            <a href="#home" className="nav-active" onClick={closeMenu}>
              Home
            </a>
          </li>

          <li>
            <a href="#about" onClick={closeMenu}>
              About Us
            </a>
          </li>

          <li>
            <a href="#features" onClick={closeMenu}>
              Features
            </a>
          </li>

          <li>
            <Link to="/login" onClick={closeMenu}>
              Attendance
            </Link>
          </li>
        </ul>

        {/* ACTION BUTTONS */}
        <div className="premium-actions">

          <Link
            to="/login"
            className="premium-login"
            onClick={closeMenu}
          >
            Admin Login <span>↗</span>
          </Link>

          <button
            type="button"
            className="premium-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="premium-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? "✕" : "☰"}
          </button>

        </div>

      </nav>
    </header>
  );
};

export default Navbar;
