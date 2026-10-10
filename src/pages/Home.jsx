import React from "react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Stats from "../components/Stats";
import About from "../components/About";
import Features from "../components/Features";


const Home = () => {
  return (
    <>
      <Navbar />
      <Hero />
      <Stats/>
      <About/>
      <Features/>
    </>
  );
};

export default Home;