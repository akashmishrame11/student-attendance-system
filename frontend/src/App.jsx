import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { ConfirmProvider } from "./components/ui";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <Router>
      <AuthProvider>
        <ConfirmProvider>
          <AppRoutes />
          <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: 14, fontFamily: "Inter, system-ui, sans-serif" } }} />
        </ConfirmProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
