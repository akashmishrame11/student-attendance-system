
import React from "react";
import {
  FaGraduationCap,
  FaTachometerAlt,
  FaUsers,
  FaCalendarCheck,
  FaChartBar,
  FaSignOutAlt,
  FaBell,
  FaUserCircle
} from "react-icons/fa";
import { Link } from "react-router-dom";

function Dashboard() {
  return (
    <div className="dashboard-layout">

   
      <aside className="dashboard-sidebar">

        <div className="dashboard-brand">
          <FaGraduationCap />
          <span>Attendify</span>
        </div>

        <p className="sidebar-heading">MAIN MENU</p>

        <nav className="sidebar-menu">

          <Link to="/dashboard" className="sidebar-link active">
            <FaTachometerAlt />
            <span>Dashboard</span>
          </Link>

          <div className="sidebar-link">
            <FaUsers />
            <span>Students</span>
          </div>

          <div className="sidebar-link">
            <FaCalendarCheck />
            <span>Attendance</span>
          </div>

          <div className="sidebar-link">
            <FaChartBar />
            <span>Reports</span>
          </div>

        </nav>

        <div className="sidebar-bottom">
          <Link to="/login" className="sidebar-link">
            <FaSignOutAlt />
            <span>Logout</span>
          </Link>
        </div>

      </aside>

      <main className="dashboard-main">

     
        <header className="dashboard-header">

          <div>
            <h2>Dashboard</h2>
            <p>Welcome to Attendify Admin Panel</p>
          </div>

          <div className="dashboard-profile">
            <FaBell />
            <FaUserCircle />
            <span>Admin</span>
          </div>

        </header>


   
        <section className="dashboard-welcome">
          <h1>Welcome Back, Admin!</h1>
          <p>
            Manage your students and monitor attendance
            from one place.
          </p>
        </section>


        
        <section className="dashboard-stats">

          <div className="dashboard-card">
            <FaUsers />
            <h3>Total Students</h3>
            <h2>40</h2>
          </div>

          <div className="dashboard-card">
            <FaCalendarCheck />
            <h3>Present Today</h3>
            <h2>30</h2>
          </div>

          <div className="dashboard-card">
            <FaChartBar />
            <h3>Absent Today</h3>
            <h2>10</h2>
          </div>

          <div className="dashboard-card">
            <FaGraduationCap />
            <h3>Attendance Rate</h3>
            <h2>88%</h2>
          </div>

        </section>

      </main>

    </div>
  );
}

export default Dashboard;
