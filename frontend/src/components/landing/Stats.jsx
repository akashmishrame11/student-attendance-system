import React, { useEffect, useState } from "react";
import api from "../../services/api";

const Stats = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/stats/public").then((res) => setData(res.data.data)).catch(() => setData(null));
  }, []);

  const value = (v, suffix = "") => (data && v !== null && v !== undefined ? `${v}${suffix}` : "—");
  const stats = [
    { number: value(data?.students), title: "Students", text: "Active students" },
    { number: value(data?.attendance, "%"), title: "Attendance", text: "Average (last 30 days)" },
    { number: value(data?.classes), title: "Classes", text: "Active class sections" },
    { number: value(data?.faculty), title: "Faculty", text: "Managing attendance" },
  ];

  return (
    <section className="stats-section">
      <div className="stats-heading">
        <span>OVERVIEW</span>
        <h2>
          Attendance at a <strong>Glance</strong>
        </h2>
        <p>Live figures from the system: students, classes and attendance.</p>
      </div>

      <div className="stats-container">
        {stats.map((item) => (
          <div className="stat-item" key={item.title}>
            <h3>{item.number}</h3>
            <h4>{item.title}</h4>
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Stats;
