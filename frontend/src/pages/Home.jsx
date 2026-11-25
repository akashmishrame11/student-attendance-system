import React from "react";
import Navbar from "../components/landing/Navbar";
import Hero from "../components/landing/Hero";
import Stats from "../components/landing/Stats";
import About from "../components/landing/About";
import Features from "../components/landing/Features";
import HowItWork from "../components/landing/HowItWorks";


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