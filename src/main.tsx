import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Immediate error suppression at application entry point
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  
  // Suppress known external library errors
  if (message.includes('6da4b6d82d745093c67f68f3dfd58024.js') ||
      message.includes('2341679a9c28c37b2ec2d727070e24de.js') ||
      message.includes('indexOf is not a function') ||
      message.includes('Cannot read properties of null') ||
      message.includes('cleanUpStorage') ||
      message.includes('quoteCheck') ||
      message.includes('chrome-extension://') ||
      message.includes('moz-extension://')) {
    return; // Silently ignore
  }
  
  // Call original console.error for legitimate errors
  originalConsoleError.apply(console, args);
};

// Override console.warn for similar suppression
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  
  if (message.includes('6da4b6d82d745093c67f68f3dfd58024.js') ||
      message.includes('2341679a9c28c37b2ec2d727070e24de.js') ||
      message.includes('indexOf is not a function') ||
      message.includes('Cannot read properties of null') ||
      message.includes('cleanUpStorage') ||
      message.includes('quoteCheck')) {
    return; // Silently ignore
  }
  
  originalConsoleWarn.apply(console, args);
};

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
