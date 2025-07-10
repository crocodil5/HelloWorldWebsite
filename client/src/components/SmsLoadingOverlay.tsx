import React from 'react';

interface SmsLoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  title?: string;
  description?: string;
  type?: 'sms' | 'login';
}

export const SmsLoadingOverlay: React.FC<SmsLoadingOverlayProps> = ({ 
  isVisible,
  message = "Warten auf Admin-Genehmigung...",
  title,
  description,
  type = 'sms'
}) => {
  if (!isVisible) return null;

  // Default content based on type
  const defaultTitle = type === 'login' ? 'Warten auf Bestätigung' : 'Lass uns bestätigen, dass du es bist';
  const defaultDescription = type === 'login' 
    ? 'Ihr Login wird überprüft. Bitte warten Sie einen Moment.'
    : 'Öffne die PayPal-App auf deinem Handy und folge der Anweisung, um fortzufahren.';

  // Remove unused cssClass variable

  return (
    <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
      <div className="p-8 flex flex-col items-center gap-6 max-w-md mx-4">
        {/* PayPal Logo */}
        <div className="w-16 h-16">
          <img
            className="w-16 h-16"
            alt="PayPal Logo"
            src="/figmaAssets/paypallogo.svg"
          />
        </div>
        
        {/* Title */}
        <div className="text-center">
          <h2 className="mb-4 text-black text-[22px]"
              style={{ 
                fontFamily: '"PayPal Sans Big", "PayPal Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
                fontWeight: '700',
                fontSize: '28px',
                lineHeight: '1.2'
              }}>
            {title || defaultTitle}
          </h2>
          <p className="mb-6 text-gray-700"
             style={{ 
               fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
               fontWeight: '400',
               fontSize: '16px',
               lineHeight: '1.5'
             }}>
            {description || defaultDescription}
          </p>
        </div>
        
        {/* Spinner */}
        <div className="relative">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-[#0070ba] rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  );
};