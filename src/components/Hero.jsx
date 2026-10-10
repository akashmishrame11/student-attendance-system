import React from "react";

const Hero = () => {
  return (
    <section className="hero" id="home">
    <div className="hero-overlay"></div>
    <div className="hero-content">
    <p className="hero-tag">
        SMART ATTENDANCE SYSTEM
    </p>
    <h1>
        Mange Student Attendance
        <span> Smarter</span>
    </h1>
    <p className="hero-description">
         A simple and efficient platform to manage students,
          track daily attendance and monitor academic presence.
          </p>

          <div className="hero-button">
            <button className="primary-btn"> Get Started → </button>

            <button className="secondary-btn">  Explore Features </button>
            </div>
          </div>
          </section>
  );
};

export default Hero;  
