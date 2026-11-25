import React from "react";
import { useNavigate } from "react-router-dom";

const Hero = () => {
  const navigate = useNavigate();
  return (
    <section className="hero" id="home">
      <div className="hero-overlay"></div>
      <div className="hero-content">
        <p className="hero-tag">SMART COLLEGE MANAGEMENT SYSTEM</p>
        <h1>
          Manage Your College
          <span> Smarter</span>
        </h1>
        <p className="hero-description">
          One platform for students, faculty and administrators — attendance, assignments,
          examinations, fees, notices and more.
        </p>

        <div className="hero-button">
          <button className="primary-btn" onClick={() => navigate("/login")}>Get Started →</button>
          <button
            className="secondary-btn"
            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
          >
            Explore Features
          </button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
