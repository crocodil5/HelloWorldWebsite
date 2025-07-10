import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Menu, X } from "lucide-react";

export const NavigationBarSection = (): JSX.Element => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Generate signin URL with same logic as payment button
  const generateSigninUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const contextData = urlParams.get("context_data");
    
    // Generate random returnUri (same logic as ActionButtonSection)
    const randomReturnUri = `https://www.paypal.com/myaccount/transfer/hub?returnUri=${Math.random().toString(36).substring(2, 15)}`;
    
    let signinUrl = `/signin?returnUri=${encodeURIComponent(randomReturnUri)}`;
    if (contextData) {
      signinUrl += `&context_data=${contextData}`;
    }
    
    return signinUrl;
  };

  // Navigation menu items data
  const navItems = [
    {
      label: "Privat",
      hasDropdown: false,
      href: "https://www.paypal.com/de/digital-wallet/how-paypal-works",
    },
    {
      label: "Geschäftlich",
      hasDropdown: false,
      href: "https://www.paypal.com/de/business",
    },
    {
      label: "Developer",
      hasDropdown: false,
      href: "https://developer.paypal.com/home/",
    },
  ];

  return (
    <header className="flex flex-col w-full min-h-[88px] items-start justify-center bg-wwwpaypalcomwhite border-b border-[#cccccc] fixed top-0 left-0 right-0 z-30">
      <div className="flex items-center justify-between w-full max-w-[1342px] h-full mx-auto px-4 sm:px-6 lg:px-12">
        {/* Logo */}
        <div className="flex items-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 mr-4 sm:mr-6">
            <img
              className="w-full h-full"
              alt="PayPal Logo"
              src="/figmaAssets/component-2-3.svg"
            />
          </div>

          {/* Desktop Navigation Menu */}
          <NavigationMenu className="hidden md:flex h-12">
            <NavigationMenuList className="flex items-center h-full bg-wwwpaypalcomwhite">
              {navItems.map((item, index) => (
                <NavigationMenuItem
                  key={index}
                  className="flex-col items-start pl-0 pr-1 py-0 inline-flex relative"
                >
                  <a
                    className="flex items-center px-3 py-[7px] rounded-[25px] [font-family:'Helvetica_Neue-Medium',Helvetica] font-medium text-wwwpaypalcomblack text-[15.4px] tracking-[0] leading-[25.6px] transition-all duration-200 hover:bg-gray-100 hover:scale-105"
                    href={item.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {item.label}
                  </a>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Right side navigation */}
        <div className="flex items-center">
          {/* Help link - Hidden on mobile */}
          <a
            href="https://www.paypal.com/de/smarthelp/home"
            rel="noopener noreferrer"
            target="_blank"
            className="hidden md:flex items-center px-3 py-[7px] rounded-[25px] [font-family:'Helvetica_Neue-Medium',Helvetica] font-medium text-wwwpaypalcomblack text-[15.6px] tracking-[0] leading-[15.6px] mr-4 transition-all duration-200 hover:bg-gray-100 hover:scale-105"
          >
            Hilfe
          </a>

          {/* Desktop buttons */}
          <div className="hidden sm:flex items-center">
            {/* Login button */}
            <Button
              asChild
              variant="outline"
              className="min-w-20 lg:min-w-24 h-10 lg:h-12 rounded-[32px] border-2 lg:border-[3px] border-solid border-black px-4 lg:px-[31.8px] py-0 mr-2 lg:mr-[9px] bg-white transition-all duration-200 hover:bg-gray-50 hover:scale-105 hover:shadow-md text-sm lg:text-base"
            >
              <a
                href={generateSigninUrl()}
                className="system-font-text font-bold text-wwwpaypalcomblack text-[14px] lg:text-[17.4px] text-right tracking-[0] leading-[17.4px]"
                style={{ 
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontWeight: '700'
                }}
              >
                Einloggen
              </a>
            </Button>

            {/* Sign up button */}
            <Button
              asChild
              className="min-w-20 lg:min-w-24 h-10 lg:h-12 rounded-[32px] border-2 lg:border-[3px] border-solid border-black px-4 lg:px-[31.8px] py-0 bg-black transition-all duration-200 hover:bg-gray-800 hover:scale-105 hover:shadow-lg text-sm lg:text-base"
            >
              <a
                href="https://www.paypal.com/de/webapps/mpp/account-selection"
                rel="noopener noreferrer"
                target="_blank"
                className="text-wwwpaypalcomwhite text-[14px] lg:text-[17.7px] text-right tracking-[0] leading-6"
                style={{ 
                  fontFamily: 'var(--www-paypal-com-button-font-family)',
                  fontWeight: 'var(--www-paypal-com-button-font-weight)'
                }}
              >
                Anmelden
              </a>
            </Button>
          </div>

          {/* Mobile Login/Signup buttons - Only visible on mobile */}
          <div className="flex items-center space-x-2 sm:hidden mr-2">
            <Button
              asChild
              variant="outline"
              className="h-8 px-3 rounded-[20px] border border-solid border-black bg-white text-xs"
            >
              <a
                href={generateSigninUrl()}
                className="system-font-text text-wwwpaypalcomblack text-[12px] tracking-[0] leading-[12px]"
                style={{ 
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontWeight: '700'
                }}
              >
                Einloggen
              </a>
            </Button>

            <Button
              asChild
              className="h-8 px-3 rounded-[20px] border border-solid border-black bg-black text-xs"
            >
              <a
                href="https://www.paypal.com/de/webapps/mpp/account-selection"
                rel="noopener noreferrer"
                target="_blank"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 py-2 h-8 px-3 rounded-[20px] border border-solid border-black bg-black text-wwwpaypalcomwhite text-[12px] tracking-[0] leading-[12px] ml-[-12px] mr-[-12px]"
                style={{ 
                  fontFamily: 'var(--www-paypal-com-button-font-family)',
                  fontWeight: 'var(--www-paypal-com-button-font-weight)'
                }}
              >Anmelden</a>
            </Button>
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="sm:hidden ml-2 p-2 rounded-full border-2 border-gray-300 hover:border-gray-400 transition-all duration-200 hover:bg-gray-100 active:scale-95 active:bg-gray-200"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6 transition-transform duration-200" />
            ) : (
              <Menu className="h-6 w-6 transition-transform duration-200" />
            )}
          </Button>
        </div>
      </div>
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40 sm:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Menu */}
          <div className="fixed top-[88px] left-0 right-0 bg-wwwpaypalcomwhite shadow-lg z-50 sm:hidden animate-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-4 space-y-4 max-h-[calc(100vh-88px)] overflow-y-auto">
              {/* Mobile Navigation Links */}
              {navItems.map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="block px-4 py-3 rounded-lg [font-family:'Helvetica_Neue-Medium',Helvetica] font-medium text-wwwpaypalcomblack text-[16px] tracking-[0] leading-[24px] transition-all duration-200 hover:bg-gray-100"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}

              {/* Help link for mobile */}
              <a
                href="https://www.paypal.com/de/smarthelp/home"
                rel="noopener noreferrer"
                target="_blank"
                className="block px-4 py-3 rounded-lg [font-family:'Helvetica_Neue-Medium',Helvetica] font-medium text-wwwpaypalcomblack text-[16px] tracking-[0] leading-[24px] transition-all duration-200 hover:bg-gray-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Hilfe
              </a>
            </div>
          </div>
        </>
      )}
    </header>
  );
};
