import React from "react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Stats from "../components/Stats";
import About from "../components/About";
import Features from "../components/Features";
import HowItWork from "../components/HowItWorks";


const Home = () => {
  return (
    <>
      <Navbar />
      <Hero />
      <Stats/>
      <About/>
      <Features/>
      <HowItWork/>
    </>
  );
};

export default Home;