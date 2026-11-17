import React from 'react';
import {
  FaUserGraduate,
  FaChalkboardTeacher,
  FaCalendarCheck,
} from 'react-icons/fa';
const FeaturesData = [
{
  icon: <FaUserGraduate />,
  id: 1,
  title:'student management',
  description: 'Easily manage student records and attendance with our intuitive system.',
},
{
  icon: <FaCalendarCheck/>,
  id: 2,
  title:'attendance tracking',
  description: 'Track attendance in real-time and generate reports effortlessly.',
},
{
  icon: <FaChalkboardTeacher/>,
  id: 3,
  title:'teacher management',
  description:'Efficiently manage teacher profiles and their attendance records.',
}
];

function Features() {
  return (
    <section className="features-section" id="features">

      <h2>Our Features</h2>

      <div className="features-container">

        {FeaturesData.map((feature) => (
          <div className="feature-card" key={feature.id}>

            <div className="feature-card-icon">
              {feature.icon}
            </div>

            <h3>{feature.title}</h3>

            <p>{feature.description}</p>

          </div>
        ))}

      </div>

    </section>
  );
}

export default Features;
