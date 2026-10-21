import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-600.css";
import "@fontsource/roboto/latin-700.css";
import "./styles.css";
import App from "./App";
import { StudentSessionProvider } from "./session";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StudentSessionProvider>
      <App />
    </StudentSessionProvider>
  </React.StrictMode>,
);
