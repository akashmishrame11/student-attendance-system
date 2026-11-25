import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaLock, FaEnvelope, FaArrowLeft } from "react-icons/fa";
import api, { errorMessage } from "../../services/api";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [sending, setSending] = useState(false);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleReset(e) {
    e.preventDefault();
    if (email.trim() === "") {
      setError("Please enter your email address");
      setMessage("");
      return;
    }
    setError("");
    setSending(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email: email.trim() });
      setMessage(data.message);
      // No email provider in development: the API returns the link so it can be tested.
      setResetUrl(data.data?.resetUrl || "");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const devPath = resetUrl ? new URL(resetUrl).pathname : "";

  return (
    <div className="forget-overview">
      <div className="forget-box">
        <div className="forget-heading">
          <div className="forget-icon">
            <FaLock />
          </div>
          <h2>Forgot Password?</h2>
          <p>Enter your registered email address to reset your password.</p>
        </div>

        <form onSubmit={handleReset} noValidate>
          <div className="forget-input-group">
            <label htmlFor="reset-email">Email Address</label>
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

          {error && <p className="forget-error">{error}</p>}
          {message && <p className="forget-message">{message}</p>}
          {devPath && (
            <p className="forget-message" style={{ wordBreak: "break-all" }}>
              Development mode: <Link to={devPath}>open the reset link</Link>
            </p>
          )}

          <button type="submit" className="forget-btn" disabled={!isEmailValid || sending}>
            {sending ? "Sending…" : "Send Reset Link"}
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
