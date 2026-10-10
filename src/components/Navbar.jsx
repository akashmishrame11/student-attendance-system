import React, { useState, useEffect } from "react";

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

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
      <nav className="premium-navbar">

        <a href="#home" className="brand" onClick={closeMenu}>
          <div className="brand-icon">🎓</div>

          <div className="brand-text">
            <h2>Attendify<span></span></h2>
            <small>CAMPUS MANAGEMENT</small>
          </div>
        </a>

        <ul className={`premium-links ${menuOpen ? "show" : ""}`}>
          <li>
            <a href="#home" className="nav-active" onClick={closeMenu}>
              Home
            </a>
          </li>
          <li><a href="#about" onClick={closeMenu}>About Us</a></li>
          <li><a href="#features" onClick={closeMenu}>Features</a></li>
          <li><a href="#attendance" onClick={closeMenu}>Attendance</a></li>
        </ul>

        <div className="premium-actions">
          <a href="/login" className="premium-login">
            Admin Login <span>↗</span>
          </a>

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