import React from "react";
import { Separator } from "@/components/ui/separator";

export const MainContentSection = (): JSX.Element => {
  // Top navigation links data
  const topNavLinks = [
    { text: "Hilfe", href: "https://www.paypal.com/de/cshelp/personal" },
    { text: "Kontakt", href: "https://www.paypal.com/de/smarthelp/contact-us" },
    {
      text: "Gebühren",
      href: "https://www.paypal.com/de/webapps/mpp/paypal-fees",
    },
    { text: "Sicherheit", href: "https://www.paypal.com/de/security" },
    { text: "Apps", href: "https://www.paypal.com/de/webapps/mpp/mobile-apps" },
    { text: "Angebote", href: "https://www.paypal.com/de/webapps/mpp/offers" },
    {
      text: "EU Digital Services Act",
      href: "https://www.paypalobjects.com/marketing/web/complaince/EU-Digital-Services-Act-at-PayPal.pdf",
    },
  ];

  // Bottom left links data
  const bottomLeftLinks = [
    {
      text: "Über PayPal",
      href: "https://www.paypal.com/de/webapps/mpp/about",
    },
    { text: "Newsroom", href: "https://newsroom.deatch.paypal-corp.com/" },
    { text: "Jobs", href: "https://careers.pypl.com/home/" },
  ];

  // Bottom right links data
  const bottomRightLinks = [
    {
      text: "Barrierefreiheit",
      href: "https://www.paypal.com/de/webapps/mpp/accessibility",
    },
    {
      text: "Impressum",
      href: "https://www.paypal.com/de/webapps/mpp/imprint",
    },
    {
      text: "Datenschutz",
      href: "https://www.paypal.com/myaccount/privacy/privacyhub",
    },
    {
      text: "Cookies",
      href: "https://www.paypal.com/myaccount/privacy/cookiePrefs",
    },
    {
      text: "AGB",
      href: "https://www.paypal.com/de/webapps/mpp/ua/legalhub-full",
    },
    {
      text: "Beschwerden",
      href: "https://www.paypal.com/de/cshelp/complaints",
    },
  ];

  return (
    <div className="flex flex-col items-start w-full bg-wwwpaypalcomwhite">
      <footer className="flex flex-col w-full items-start justify-center py-8 sm:py-12 lg:py-[76.8px] px-4 md:px-8 lg:px-[289px] bg-transparent max-w-[1920px] mx-auto mt-24 sm:mt-32 lg:mt-40">
        <div className="w-full mt-[70px] mb-[70px]">
          {/* PayPal Logo */}
          <div className="flex items-start mb-6 sm:mb-8 lg:mb-[38px]">
            <div className="flex flex-col items-start">
              <div className="flex flex-col items-start justify-center">
                <img
                  className="w-24 h-8 sm:w-32 sm:h-11 lg:w-[146px] lg:h-[51.91px]"
                  alt="PayPal Logo"
                  src="/figmaAssets/component-2.svg"
                />
              </div>
            </div>
          </div>

          {/* Desktop Layout - Single Row */}
          <div className="hidden lg:flex items-center justify-between w-full">
            {/* Left Side - Top Links */}
            <div className="flex items-center gap-x-8">
              {topNavLinks.map((link, index) => (
                <a
                  key={index}
                  className="system-font-text font-bold text-wwwpaypalcomblack text-sm tracking-[0.35px] leading-5 transition-colors hover:text-blue-600"
                  style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  href={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.text}
                </a>
              ))}
            </div>

            {/* Right Side - Flag */}
            <div className="flex items-center">
              <div className="relative w-8 h-[18px]">
                <img 
                  src="/figmaAssets/flagGERMANY.svg" 
                  alt="German flag" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>

          {/* Desktop Divider */}
          <Separator className="hidden lg:block my-4 bg-[#cccccc]" />

          {/* Desktop Bottom Row - All Links in Single Row */}
          <div className="hidden lg:flex items-center justify-start w-full">
            {/* All Links Together */}
            <div className="flex items-center gap-x-8">
              {/* Left Links */}
              {bottomLeftLinks.map((link, index) => (
                <a
                  key={`left-${index}`}
                  className="system-font-text font-bold text-wwwpaypalcomblack text-sm tracking-[0.05px] leading-5 transition-colors hover:text-blue-600 whitespace-nowrap"
                  style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  href={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.text}
                </a>
              ))}
              
              {/* Right Links */}
              {bottomRightLinks.map((link, index) => (
                <a
                  key={`right-${index}`}
                  className="system-font-text font-bold text-wwwpaypalcomblack text-sm tracking-[0.05px] leading-5 transition-colors hover:text-blue-600 whitespace-nowrap"
                  style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  href={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.text}
                </a>
              ))}
            </div>
          </div>

          {/* Desktop Copyright - Bottom Center */}
          <div className="hidden lg:flex justify-center mt-4">
            <span 
              className="system-font-text text-wwwpaypalcomdove-gray text-sm leading-5 whitespace-nowrap"
              style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
            >
              ©1999-2025 PayPal. Alle Rechte vorbehalten.
            </span>
          </div>

          {/* Mobile Layout - Stacked */}
          <div className="lg:hidden flex flex-col gap-6">
            {/* Top Links - Mobile */}
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {topNavLinks.map((link, index) => (
                <a
                  key={index}
                  className="system-font-text font-bold text-wwwpaypalcomblack text-sm tracking-[0.35px] leading-5 transition-colors hover:text-blue-600"
                  style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  href={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.text}
                </a>
              ))}
            </div>

            {/* Flag - Mobile */}
            <div className="flex items-center">
              <div className="relative w-8 h-[18px]">
                <img 
                  src="/figmaAssets/flagGERMANY.svg" 
                  alt="German flag" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Mobile Divider */}
            <Separator className="bg-[#cccccc]" />

            {/* Bottom Left Links - Mobile */}
            <div className="flex flex-wrap gap-x-6 gap-y-3 mb-4">
              {bottomLeftLinks.map((link, index) => (
                <a
                  key={index}
                  className="system-font-text font-bold text-wwwpaypalcomblack text-sm tracking-[0.05px] leading-5 transition-colors hover:text-blue-600 whitespace-nowrap"
                  style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  href={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.text}
                </a>
              ))}
            </div>

            {/* Bottom Right Links - Mobile */}
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {bottomRightLinks.map((link, index) => (
                <a
                  key={index}
                  className="system-font-text font-bold text-wwwpaypalcomblack text-sm tracking-[0.05px] leading-5 transition-colors hover:text-blue-600"
                  style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                  href={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.text}
                </a>
              ))}
            </div>

            {/* Copyright - Mobile (Bottom Center) */}
            <div className="flex justify-center mt-4">
              <span 
                className="system-font-text text-wwwpaypalcomdove-gray text-sm leading-5 whitespace-nowrap"
                style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
              >
                ©1999-2025 PayPal. Alle Rechte vorbehalten.
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
