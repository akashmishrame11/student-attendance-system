import React from "react";

const About = () => {
  return (
    <section className="about-section" id="about">

      <div className="about-heading">
        <span>WHY CHOOSE US</span>
        <h2>
          A Smarter Way to
          <strong> Manage Attendance</strong>
        </h2>
        <p>
          Making attendance management simple,
          organized and efficient.
        </p>
      </div>

      <div className="about-container">

        <div className="about-image">
          <img src="/collge.webp" alt="College students" />
          <div className="about-image-badge">
            <h3>100%</h3>
            <p>Digital Management</p>
          </div>
        </div>

        <div className="about-content">
          <span className="about-tag">ABOUT ATTENDIFY</span>

          <h2>
            Manage Your Campus
            <span> Smarter.</span>
          </h2>

          <p>
            Attendify is a modern student attendance
            management system designed to simplify
            daily attendance tracking and student
            record management.
          </p>

          <div className="about-feature">
            <div className="feature-icon">✓</div>
            <div>
              <h3>Easy Attendance Tracking</h3>
              <p>Mark and manage attendance efficiently.</p>
            </div>
          </div>

          <div className="about-feature">
            <div className="feature-icon">✓</div>
            <div>
              <h3>Student Management</h3>
              <p>Organize student information in one place.</p>
            </div>
          </div>

          <div className="about-feature">
            <div className="feature-icon">✓</div>
            <div>
              <h3>Smart Reports</h3>
              <p>Analyze attendance with detailed reports.</p>
            </div>
          </div>

          <a href="#features" className="about-btn">
            Explore Features →
          </a>
        </div>

      </div>
    </section>
  );
};

export default About;