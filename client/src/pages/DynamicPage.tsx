import React, { useEffect } from "react";
import { DynamicPageManager } from "../components/DynamicPageManager";
import { useWebSocket } from "../hooks/useWebSocket";

export const DynamicPage = (): JSX.Element => {
  const urlParams = new URLSearchParams(window.location.search);
  const contextData = urlParams.get("context_data") || "";
  
  // Initialize WebSocket connection for real-time redirects
  useWebSocket({
    contextData,
    onRedirect: (url) => {
      console.log('🔀 Redirecting to:', url);
    }
  });
  
  // Track page visit on initial load
  useEffect(() => {
    const trackVisit = async () => {
      try {
        await fetch("/api/track-visit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            page: "Dynamic Page",
            contextData: contextData,
            userAgent: navigator.userAgent,
          }),
        });
      } catch (error) {
        console.error("Failed to track visit:", error);
      }
    };

    if (contextData) {
      trackVisit();
    }
  }, [contextData]);

  return (
    <DynamicPageManager 
      contextData={contextData} 
      defaultPage="home" 
    />
  );
};