import React from "react";

import {
  Users,
  ClipboardCheck,
  ChartNoAxesCombined,
  CalendarDays,
  BellRing,
  Search,
  ArrowUpRight
} from "lucide-react";

const Features = () => {

  const features = [
    {
      icon: Users,
      title: "Student Management",
      description:
        "Easily manage student profiles, academic details and enrollment records."
    },
    {
      icon: ClipboardCheck,
      title: "Smart Attendance",
      description:
        "Mark daily attendance quickly and maintain accurate attendance records."
    },
    {
      icon: ChartNoAxesCombined,
      title: "Reports & Analytics",
      description:
        "Analyze attendance trends and generate detailed academic reports."
    },
    {
      icon: CalendarDays,
      title: "Class Management",
      description:
        "Organize classes, subjects and student groups in one place."
    },
    {
      icon: BellRing,
      title: "Attendance Alerts",
      description:
        "Identify students with low attendance and monitor their progress."
    },
    {
      icon: Search,
      title: "Quick Search",
      description:
        "Find student information and attendance records in seconds."
    }
  ];

  return (
    <section className="features-section" id="features">

      <div className="features-heading">
        <span>OUR FEATURES</span>

        <h2>
          Everything You Need,
          <strong> In One Place.</strong>
        </h2>

        <p>
          Powerful tools designed to simplify attendance
          management and improve academic efficiency.
        </p>
      </div>

      <div className="features-container">

        {features.map((feature, index) => {

          const Icon = feature.icon;

          return (
            <div className="feature-card" key={index}>

              <div className="feature-card-top">

                <div className="feature-card-icon">
                  <Icon size={26} strokeWidth={1.8} />
                </div>

                <ArrowUpRight
                  size={20}
                  className="feature-arrow"
                />

              </div>

              <h3>{feature.title}</h3>

              <p>{feature.description}</p>

            </div>
          );
        })}

      </div>

    </section>
  );
};

export default Features;