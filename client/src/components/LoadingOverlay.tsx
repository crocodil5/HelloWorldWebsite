import React from 'react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isVisible, 
  message = "Einloggen wird verarbeitet..." 
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-6 max-w-sm mx-4">
        
        
        {/* Spinner */}
        <div className="relative">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        
        {/* Message */}
        <div className="text-center" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <p className="text-gray-700 mb-2 font-bold" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>{message}</p>
          <p className="text-sm text-gray-500" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            Bitte warten Sie einen Moment...
          </p>
        </div>
      </div>
    </div>
  );
};