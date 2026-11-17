
import React, { useState } from "react";

import {
  FaEye,
  FaEyeSlash,
  FaGraduationCap,
  FaShieldAlt
} from "react-icons/fa";

import { Link, useNavigate } from "react-router-dom";

function Login() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // LOGIN FUNCTION
  function handleSubmit(e) {
    e.preventDefault();

    // Empty field validation
    if (email.trim() === "" || password.trim() === "") {
      setError("Please enter your email and password.");
      return;
    }

    // Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    // Clear error
    setError("");

    // Demo navigation to Dashboard
    navigate("/dashboard");
  }

  return (

    <div className="login-page">

      <div className="login-container">

        {/* LEFT ANIMATED PANEL */}

        <div className="login-left">

          <div className="abstract-ring"></div>

          <div className="abstract-sphere sphere-one"></div>
          <div className="abstract-sphere sphere-two"></div>
          <div className="abstract-sphere sphere-three"></div>

          <div className="abstract-brand">
            <FaGraduationCap />
            <span>Attendify</span>
          </div>

          <div className="abstract-caption">
            <h2>Smart Attendance Management</h2>

            <p>
              Manage students, track attendance
              and generate reports in one place.
            </p>
          </div>
<div className="login-security">
  <FaShieldAlt />
  <span>Secure Admin Portal</span>
</div>

        </div>



        <div className="login-right">

          <div className="login-form-header">
            <h2>Welcome Back</h2>
            <p>Sign in to your admin account</p>
          </div>


          <form
            className="login-form"
            onSubmit={handleSubmit}
            noValidate
          >

            {/* EMAIL FIELD */}

            <div className="login-input-group">

              <label htmlFor="admin-email">
                Email Address
              </label>

              <input
                type="email"
                id="admin-email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                required
              />

            </div>


            {/* PASSWORD FIELD */}

            <div className="login-input-group">

              <label htmlFor="admin-password">
                Password
              </label>

              <div className="password-wrapper">

                <input
                  type={showPassword ? "text" : "password"}
                  id="admin-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>

              </div>

            </div>


            {/* FORGOT PASSWORD */}

            <div className="forgot-password">

              <Link to="/forget">
                Forgot Password?
              </Link>

            </div>


            {/* ERROR MESSAGE */}

            {error && (
              <p className="login-error">
                {error}
              </p>
            )}


            {/* SIGN IN BUTTON */}

            <button
              type="submit"
              className="login-btn"
            >
              Sign In
            </button>

          </form>


          <p className="login-footer-text">
            Authorized access only
          </p>

        </div>

      </div>

    </div>

  );
}

export default Login;
