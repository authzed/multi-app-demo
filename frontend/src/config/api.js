// API URL configuration for different environments
const getApiUrls = () => {
  // HARDCODE ID: Uncomment and set the ID below to override auto-detection
  // const HARDCODED_ID = 'your-id-here';
  
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Check if we're running in Instruqt environment
  if (hostname.includes('.env.play.instruqt.com')) {
    // Use hardcoded ID if provided, otherwise extract from URL
    let id;
    if (typeof HARDCODED_ID !== 'undefined' && HARDCODED_ID) {
      id = HARDCODED_ID;
    } else {
      const match = hostname.match(/cloud-(\d+)-(.+)\.env\.play\.instruqt\.com/);
      if (match) {
        id = match[2];
      }
    }
    
    if (id) {
      return {
        groups: `${protocol}//cloud-3001-${id}.env.play.instruqt.com`,
        mail: `${protocol}//cloud-3002-${id}.env.play.instruqt.com`,
        docs: `${protocol}//cloud-3003-${id}.env.play.instruqt.com`
      };
    }
  }
  
  // Default to localhost for local development
  return {
    groups: 'http://localhost:3001',
    mail: 'http://localhost:3002',
    docs: 'http://localhost:3003'
  };
};

export const API_URLS = getApiUrls();

// Centralized API fetch function with credentials
export const apiRequest = async (url, options = {}) => {
  const defaultOptions = {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  return fetch(url, defaultOptions);
};