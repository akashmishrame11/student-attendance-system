import React from "react";

const Stats = () => {
  const stats = [
    {
      number: "500+",
      title: "Students",
      text: "Active students"
    },
    {
      number: "92%",
      title: "Attendance",
      text: "Average attendance"
    },
    {
      number: "25+",
      title: "Classes",
      text: "Active classes"
    },
    {
      number: "10+",
      title: "Faculty",
      text: "Managing attendance"
    }
  ];

  return (
    <section className="stats-section">

      <div className="stats-heading">
        <span>OVERVIEW</span>
        <h2>
          Attendance at a <strong>Glance</strong>
        </h2>
        <p>
          A quick overview of students, classes and attendance
          across the system.
        </p>
      </div>

      <div className="stats-container">
        {stats.map((item, index) => (
          <div className="stat-item" key={index}>
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