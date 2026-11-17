
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaLock, FaEnvelope, FaArrowLeft } from "react-icons/fa";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

   const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isEmailValid = emailPattern.test(email.trim());

  function handleReset(e) {
    e.preventDefault();

    if (email.trim() === "") {
      setError("Please enter your email address");
      setMessage("");
      return;
    }

    setError("");
    setMessage("Reset email service is not connected yet.");
  }

  return (
    <div className="forget-overview">
      <div className="forget-box">

        <div className="forget-heading">
          <div className="forget-icon">
            <FaLock />
          </div>

          <h2>Forgot Password?</h2>

          <p>
            Enter your registered email address
            to reset your password.
          </p>
        </div>

        <form onSubmit={handleReset} noValidate>
          <div className="forget-input-group">
            <label htmlFor="reset-email">
              Email Address
            </label>

            <div className="forget-input-wrapper">
              <FaEnvelope className="forget-email-icon" />

              <input
                type="email"
                id="reset-email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="forget-error">{error}</p>
          )}

          {message && (
            <p className="forget-message">{message}</p>
          )}

          <button
  type="submit"
  className="forget-btn"
  disabled={!isEmailValid}
>
  Send Reset Link
</button>
        </form>

        <Link to="/login" className="forget-back">
          <FaArrowLeft />
          <span>Back to Login</span>
        </Link>

      </div>
    </div>
  );
}

export default ForgotPassword;
