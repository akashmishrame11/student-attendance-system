import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaKey, FaArrowLeft } from "react-icons/fa";
import toast from "react-hot-toast";
import api, { errorMessage } from "../../services/api";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Password must be at least 8 characters and contain a letter and a number.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post(`/auth/reset-password/${token}`, { password });
      toast.success(data.message);
      navigate("/login", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="forget-overview">
      <div className="forget-box">
        <div className="forget-heading">
          <div className="forget-icon"><FaKey /></div>
          <h2>Set a new password</h2>
          <p>Choose a strong password with at least 8 characters.</p>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="forget-input-group">
            <label htmlFor="new-password">New password</label>
            <div className="forget-input-wrapper">
              <input id="new-password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="New password" style={{ paddingLeft: 14 }} />
            </div>
          </div>
          <div className="forget-input-group">
            <label htmlFor="confirm-password">Confirm password</label>
            <div className="forget-input-wrapper">
              <input id="confirm-password" type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); }} placeholder="Repeat password" style={{ paddingLeft: 14 }} />
            </div>
          </div>
          {error && <p className="forget-error">{error}</p>}
          <button type="submit" className="forget-btn" disabled={saving || !password}>{saving ? "Saving…" : "Reset Password"}</button>
        </form>
        <Link to="/login" className="forget-back"><FaArrowLeft /><span>Back to Login</span></Link>
      </div>
    </div>
  );
}
