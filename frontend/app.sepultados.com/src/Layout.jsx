// src/Layout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./components/Navbar";
import Topbar from "./components/Topbar";

const Layout = () => {
  return (
    <>
      <Navbar />
      <Topbar />
      <main className="ml-64 mt-14 px-6 py-4 bg-[#e3efcc] min-h-screen">
        <Outlet />
      </main>
    </>
  );
};

export default Layout;
