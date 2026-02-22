import React, { useEffect, useRef } from 'react';

const AdSense = ({ slot, format = 'auto', responsive = true, className = '' }) => {
  const adRef = useRef(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!pushed.current && adRef.current) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      } catch (e) {
        // AdSense not loaded yet — ignore
      }
    }
  }, []);

  return (
    <div className={className}>
      <div className="text-xs text-slate-500 mb-1 text-center">Advertisement</div>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-XXXXXXXX"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
};

export default AdSense;
