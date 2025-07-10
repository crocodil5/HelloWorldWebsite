import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export const Link2Page = (): JSX.Element => {
  // State for input focus and values
  const [emailFocused, setEmailFocused] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");

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

  return (
    <div className="flex flex-col min-h-screen items-start pt-8 md:pt-[120px] pb-0 relative bg-wwwpaypalcomwhite px-4 md:px-0">
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

            <CardContent className="flex flex-col items-start gap-[31.91px] p-0 w-full">
              <div className="flex flex-col items-start w-full">
                <div className="flex flex-col items-start gap-4 w-full">
                  <div className="relative w-full">
                    <Input
                      className="h-12 md:h-16 pt-6 md:pt-[30.5px] pb-3 md:pb-[16.5px] px-3 border border-solid border-[#999999] rounded-md focus:outline-none focus:border-blue-500"
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                    />
                    <label 
                      className={`absolute left-[11px] font-www-paypal-com-semantic-label text-wwwpaypalcomnevada transition-all duration-200 ease-in-out pointer-events-none ${
                        emailFocused || emailValue 
                          ? 'top-[6px] md:top-[8px] text-xs' 
                          : 'top-[12px] md:top-[19px] text-sm md:text-base'
                      }`}
                    >
                      E-Mail-Adresse oder Handynummer
                    </label>
                  </div>

                  <div className="flex flex-col items-start gap-4 w-full pb-4">
                    <div className="relative w-full">
                      <Input
                        className="h-12 md:h-16 pt-6 md:pt-[30.5px] pb-3 md:pb-[16.5px] px-3 border border-solid border-[#999999] rounded-md focus:outline-none focus:border-blue-500"
                        type="password"
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                      />
                      <label 
                        className={`absolute left-[11px] font-www-paypal-com-semantic-label text-wwwpaypalcomnevada transition-all duration-200 ease-in-out pointer-events-none ${
                          passwordFocused || passwordValue 
                            ? 'top-[6px] md:top-[8px] text-xs' 
                            : 'top-[12px] md:top-[19px] text-sm md:text-base'
                        }`}
                      >
                        Passwort
                      </label>
                    </div>

                    <a
                      className="text-wwwpaypalcomscience-blue text-base font-normal [font-family:'Helvetica_Neue-Regular',Helvetica]"
                      href="https://www.paypal.com/authflow/password-recovery/"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Passwort vergessen?
                    </a>
                  </div>
                </div>

                <Button className="w-full h-12 md:h-12 bg-[#0551b5] rounded-[100px] border-2 border-solid text-wwwpaypalcomwhite [font-family:'Helvetica_Neue-Medium',Helvetica] font-medium text-sm md:text-base hover:bg-[#0441a0] transition-colors duration-200">
                  Einloggen
                </Button>
              </div>

              <div className="flex flex-col items-start gap-[17.92px] w-full">
                <div className="relative w-full h-[15px]">
                  <Separator className="border-t border-[#cbd2d6]" />
                  <div className="inline-flex items-start justify-center px-[7.5px] py-0 absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-wwwpaypalcomwhite">
                    <span className="font-www-paypal-com-helvetica-neue-regular text-wwwpaypalcomnevada text-center whitespace-nowrap">
                      oder
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full h-12 md:h-12 rounded-[100px] border-2 border-solid border-black text-wwwpaypalcomblack font-www-paypal-com-helvetica-neue-medium text-center text-sm md:text-base transition-all duration-300 ease-in-out hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600"
                  onClick={() => window.open("https://www.paypal.com/de/webapps/mpp/account-selection", "_blank")}
                >
                  Neu anmelden
                </Button>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-center p-0 w-full h-[66.5px]">
              <div className="flex items-center justify-center gap-1.5">
                <div className="flex items-center gap-2">
                  <svg 
                    className="w-5 h-4 rounded-sm shadow-sm border border-gray-200" 
                    viewBox="0 0 30 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect width="30" height="6.67" fill="#646464" />
                    <rect width="30" height="6.67" y="6.67" fill="#e9686b" />
                    <rect width="30" height="6.66" y="13.34" fill="#f8e96a" />
                  </svg>
                  <button
                    className="[font-family:'Helvetica_Neue-Bold',Helvetica] font-bold text-wwwpaypalcomshuttle-gray text-base text-center leading-5 whitespace-nowrap bg-transparent border-none cursor-pointer hover:text-blue-600 transition-colors duration-200"
                    onClick={() => window.location.reload()}
                  >
                    Deutsch
                  </button>
                </div>

                <div className="flex items-center h-4 border-l border-[#cccccc] pl-3">
                  <button
                    className="[font-family:'Helvetica_Neue-Regular',Helvetica] font-normal text-wwwpaypalcomshuttle-gray text-base text-center leading-5 whitespace-nowrap bg-transparent border-none cursor-pointer hover:text-blue-600 transition-colors duration-200"
                    onClick={() => window.location.reload()}
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
                    className="[font-family:'Helvetica_Neue-Regular',Helvetica] font-normal text-wwwpaypalcomshuttle-gray text-[9px] md:text-[11px] text-center leading-[14px] md:leading-[18px] whitespace-nowrap hover:text-blue-600 transition-colors duration-200"
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
  );
};