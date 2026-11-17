import React from "react";

import {
  FaSignInAlt,
  FaUserPlus,
  FaClipboardCheck,
  FaChartBar
} from "react-icons/fa";

const stepsData = [
    {
        id : 1,
        icon:<FaChartBar/>,
        title:'Admin login',
        description:'Admin or teacher securely logs into the system.'
    }, 
    {
        id : 2,
        icon:<FaSignInAlt/>,
        title:'Add Students',
        description: "Add and manage student details."
    },
    {
        id:3,
        icon:<FaUserPlus/>,
        title:'Mark Attendance',
         description:"Mark students present or absent."
    },
    {
        id:4,
        icon:<FaClipboardCheck/>,
        title:'View Reports',
        description:"View attendance records and reports."
    }
]
function HowItWork (){
    return(
  <section className="how-section" id="how-it-work">
    <h2>How it works</h2>
    <p> Manage attendance in four simple steps</p>
    <div className="how-container">
      
   {stepsData.map((step)=> (
    <div className="how-card" key={step.id}>
        <div className="how-icon">
        {step.icon}</div>

        <h3>{step.title}</h3>

        <p>{step.description}</p>

    </div>      
  
 ))}
            </div>
  </section> )};

  export default HowItWork;


