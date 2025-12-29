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
    // 1. Define the callback FluidPay calls after it generates a token
    (window as any).fluidPayCallback = (response: any) => {
      if (response && response.token) {
        console.log("[FluidPay] Token generated successfully:", response.token)
        
        // Notify the component via prop
        if (onTokenReceived) onTokenReceived(response.token)
        
        // Notify the PaymentButton via Global Event
        const event = new CustomEvent("fluidpay_token_received", { detail: response.token })
        window.dispatchEvent(event)
      } else {
        console.error("[FluidPay] Tokenization failed:", response)
      }
    }

    // 2. Listener for the trigger from Review Step
    const handleTriggerTokenize = () => {
      console.log("[FluidPay] Triggering tokenizer submit...")
      if ((window as any).FluidPayTokenizer) {
        (window as any).FluidPayTokenizer.submit()
      } else {
        console.error("[FluidPay] FluidPayTokenizer script not found on window")
      }
    }

    window.addEventListener("triggerFluidPayTokenize", handleTriggerTokenize)
    return () => window.removeEventListener("triggerFluidPayTokenize", handleTriggerTokenize)
  }, [onTokenReceived])

  return (
    <>
      <Script 
        src={`${srcBaseUrl}/tokenizer/tokenizer.js`} 
        strategy="afterInteractive" 
      />
      <div className="mt-4 p-4 border rounded-md bg-white min-h-[250px]">
        {/* Container must be visible immediately so user can type */}
        <div 
          id="fluidpay-tokenizer-container" 
          data-public-key={publicKey}
          data-callback="fluidPayCallback"
        >
          {/* Iframe renders here */}
        </div>
      </div>
    </>
  )
}

export default FluidPayTokenizerLoader