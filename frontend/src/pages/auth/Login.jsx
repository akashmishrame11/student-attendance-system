import React, { useState } from "react";
import { FaEye, FaEyeSlash, FaGraduationCap, FaShieldAlt } from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, HOME_BY_ROLE } from "../../context/AuthContext";
import { errorMessage } from "../../services/api";

const DEMO = [
  { role: "Admin", identifier: "admin@college.edu", password: "Admin@123" },
  { role: "Faculty", identifier: "faculty1@college.edu", password: "Faculty@123" },
  { role: "Student", identifier: "student1@college.edu", password: "Student@123" },
];

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (identifier.trim() === "" || password.trim() === "") {
      setError("Please enter your email/username and password.");
      return;
    }
    if (identifier.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const user = await login(identifier.trim(), password);
      const from = location.state?.from;
      navigate(from && from.startsWith(`/${user.role}`) ? from : HOME_BY_ROLE[user.role], { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Login failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left">
          <div className="abstract-ring"></div>
          <div className="abstract-sphere sphere-one"></div>
          <div className="abstract-sphere sphere-two"></div>
          <div className="abstract-sphere sphere-three"></div>

          <Link to="/" className="abstract-brand" style={{ textDecoration: "none" }}>
            <FaGraduationCap />
            <span>Attendify</span>
          </Link>

          <div className="abstract-caption">
            <h2>Smart College Management</h2>
            <p>Students, faculty, attendance, assignments, exams and fees — managed in one place.</p>
          </div>
          <div className="login-security">
            <FaShieldAlt />
            <span>Secure Role-Based Portal</span>
          </div>
        </div>

        <div className="login-right">
          <div className="login-form-header">
            <h2>Welcome Back</h2>
            <p>Sign in as Admin, Faculty or Student</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-input-group">
              <label htmlFor="login-identifier">Email or Username</label>
              <input
                type="text"
                id="login-identifier"
                placeholder="e.g. admin@college.edu or STU20250001"
                autoComplete="username"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setError("");
                }}
                required
              />
            </div>

            <div className="login-input-group">
              <label htmlFor="login-password">Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="login-password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
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
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div className="forgot-password">
              <Link to="/forget">Forgot Password?</Link>
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button type="submit" className="login-btn" disabled={submitting} style={submitting ? { opacity: 0.7 } : undefined}>
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div style={{ marginTop: 18 }}>
            <p className="login-footer-text" style={{ marginBottom: 8 }}>Demo accounts (click to fill)</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {DEMO.map((d) => (
                <button
                  key={d.role}
                  type="button"
                  onClick={() => {
                    setIdentifier(d.identifier);
                    setPassword(d.password);
                    setError("");
                  }}
                  style={{ border: "1px solid #c7d2fe", background: "#eef2ff", color: "#1e3a8a", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  {d.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
