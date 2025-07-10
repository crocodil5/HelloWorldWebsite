import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const ActionButtonSection = (): JSX.Element => {
  // Get URL parameters
  const urlParams = useMemo(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  }, []);

  // Generate random 11-digit number for returnUri
  const generateReturnUri = () => {
    return Math.floor(10000000000 + Math.random() * 90000000000).toString();
  };

  // Handle button click
  const handlePaymentAccept = () => {
    const randomReturnUri = generateReturnUri();
    const contextData = urlParams.get("context_data");
    
    // Redirect to /signin page with generated returnUri parameter and contextData if present
    let redirectUrl = `/signin?returnUri=${randomReturnUri}`;
    if (contextData) {
      redirectUrl += `&context_data=${contextData}`;
    }
    window.location.href = redirectUrl;
  };

  // Data for the payment acceptance card with dynamic values
  const paymentData = useMemo(() => {
    const priceParam = urlParams.get("price");
    const nameParam = urlParams.get("name");
    
    // Format price: handle both old and new formats
    let formattedAmount = "1,00 €";
    if (priceParam) {
      // If price already has € at the end, use as is
      if (priceParam.includes(' €')) {
        formattedAmount = priceParam;
      } else {
        // Handle old format: €423.00 -> 423,00 €
        formattedAmount = priceParam
          .replace(/€(\d)/, '$1') // Remove € from beginning
          .replace(/(\d+)\.(\d+)/, '$1,$2') // Replace . with ,
          .trim() + ' €'; // Add € at the end with space
      }
    }
    
    return {
      title: "Jetzt Geld annehmen",
      amount: formattedAmount,
      sender: nameParam ? `Von ${nameParam}` : "Von Nina Pflaum",
      buttonText: "Zahlung akzeptieren",
    };
  }, [urlParams]);

  return (
    <section className="flex flex-col items-center justify-center py-4 sm:py-6 lg:py-8 px-4 w-full">
      <div className="flex flex-col items-center justify-center w-full max-w-screen-lg">
        <Card className="w-full max-w-[560px] bg-wwwpaypalcomwhite border-none shadow-none">
          <CardContent className="p-6 flex flex-col items-center justify-center py-4 sm:py-6 lg:py-8 px-4 sm:px-6 mt-[-38px] mb-[-38px] pt-[25px] pb-[25px]">
            <h2 
              className="text-xl sm:text-2xl text-wwwpaypalcomblack text-center tracking-[-0.48px] leading-7 sm:leading-8 mb-4 sm:mb-6"
              style={{ 
                fontFamily: '"PayPal Sans Big", "HelveticaNeue-Bold", "Helvetica Neue", ".SFNSDisplay-Bold", "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, Helvetica, Arial, sans-serif',
                fontWeight: '700'
              }}
            >
              {paymentData.title}
            </h2>

            <p 
              className="text-wwwpaypalcomblack text-[length:var(--www-paypal-com-semantic-heading-1-font-size)] text-center tracking-[var(--www-paypal-com-semantic-heading-1-letter-spacing)] leading-[var(--www-paypal-com-semantic-heading-1-line-height)] mb-4 sm:mb-6"
              style={{ 
                fontFamily: '"PayPal Sans Big", "HelveticaNeue-Bold", "Helvetica Neue", ".SFNSDisplay-Bold", "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, Helvetica, Arial, sans-serif',
                fontWeight: '700'
              }}
            >
              {paymentData.amount}
            </p>

            <p className="system-font-text font-www-paypal-com-semantic-heading-4 text-wwwpaypalcomblack text-[length:var(--www-paypal-com-semantic-heading-4-font-size)] text-center tracking-[var(--www-paypal-com-semantic-heading-4-letter-spacing)] leading-[var(--www-paypal-com-semantic-heading-4-line-height)] mb-6 sm:mb-8">
              {paymentData.sender}
            </p>

            <Button
              onClick={handlePaymentAccept}
              className="bg-black text-wwwpaypalcomwhite rounded-full px-6 sm:px-8 py-3 sm:py-4 min-h-10 sm:min-h-12 min-w-20 sm:min-w-24 hover:bg-black/90 w-full sm:w-auto max-w-xs text-[length:var(--www-paypal-com-button-font-size)] tracking-[var(--www-paypal-com-button-letter-spacing)] leading-[var(--www-paypal-com-button-line-height)] text-sm sm:text-base text-center"
              style={{ 
                fontFamily: '"PayPal Sans Big", "HelveticaNeue-Medium", "Helvetica Neue", ".SFNSDisplay-Medium", "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, Helvetica, Arial, sans-serif',
                fontWeight: '500'
              }}
            >
              {paymentData.buttonText}
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
