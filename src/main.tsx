import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App";
import { CommunityProvider } from "./context/Community";
import "./styles.css";
const Router = import.meta.env.VITE_GITHUB_PAGES === "true" ? HashRouter : BrowserRouter;
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router>
      <CommunityProvider>
        <App />
      </CommunityProvider>
    </Router>
  </React.StrictMode>,
);
