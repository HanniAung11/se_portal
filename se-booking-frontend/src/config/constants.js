// API Configuration
// Use environment variable in production, localhost in development
const getApiBaseUrl = () => {
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  
  if (isLocalhost) {
    return "http://localhost:8000";
  }
  
  // In production, use environment variable (required)
  const apiUrl = import.meta.env.VITE_API_URL;
  
  if (!apiUrl) {
    console.error("VITE_API_URL environment variable is not set! Please configure it in Vercel.");
    return "";
  }
  
  return apiUrl;
};

export const API_BASE_URL = getApiBaseUrl();

// EmailJS Configuration
export const EMAIL_CONFIG = {
  publicKey: "0u3TvKABvdtKTkOC8",
  serviceID: "service_sq31cdj",
  templateID: "template_tlthlwi",
  adminEmail: "mnc9135@gmail.com",
};

