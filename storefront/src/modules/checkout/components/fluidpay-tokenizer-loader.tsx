"use client"
import React, { useEffect } from "react"
import Script from "next/script"

type Props = {
  srcBaseUrl: string
  publicKey: string
  cartId: string
  onTokenReceived?: (token: string) => void
}

const FluidPayTokenizerLoader: React.FC<Props> = ({ 
  srcBaseUrl, 
  publicKey, 
  onTokenReceived 
}) => {
  useEffect(() => {
    // Defines the global callback required by FluidPay
    (window as any).fluidPayCallback = (response: any) => {
      if (response && response.token) {
        console.log("[FluidPay] Token generated:", response.token)
        const event = new CustomEvent("fluidpay_token_received", { detail: response.token });
        window.dispatchEvent(event);
        if (onTokenReceived) onTokenReceived(response.token);
      }
    };

    // Global listener to trigger submission from the Review step
    const handleTriggerTokenize = () => {
      console.log("[FluidPay] Submit triggered via global event");
      if ((window as any).FluidPayTokenizer) {
        (window as any).FluidPayTokenizer.submit();
      }
    };

    window.addEventListener("triggerFluidPayTokenize", handleTriggerTokenize);
    return () => window.removeEventListener("triggerFluidPayTokenize", handleTriggerTokenize);
  }, [onTokenReceived]);

  // If srcBaseUrl is still undefined, we render nothing to prevent 404s
  if (!srcBaseUrl || srcBaseUrl === "undefined") return null;

  return (
    <>
      <Script 
        src={`${srcBaseUrl}/tokenizer/tokenizer.js`} 
        strategy="afterInteractive" 
      />
      <div className="mt-4">
        <div 
          id="fluidpay-tokenizer-container" 
          className="min-h-[200px] w-full border rounded-md p-4 bg-white"
          data-public-key={publicKey}
          data-callback="fluidPayCallback"
        >
          {/* FluidPay iframe renders here automatically after script loads */}
        </div>
      </div>
    </>
  )
}

export default FluidPayTokenizerLoader