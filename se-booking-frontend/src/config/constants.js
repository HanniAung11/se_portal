// API Configuration
// Use environment variable in production, localhost in development
export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : "http://localhost:8000");

// EmailJS Configuration
export const EMAIL_CONFIG = {
  publicKey: "0u3TvKABvdtKTkOC8",
  serviceID: "service_sq31cdj",
  templateID: "template_tlthlwi",
  adminEmail: "mnc9135@gmail.com",
};

