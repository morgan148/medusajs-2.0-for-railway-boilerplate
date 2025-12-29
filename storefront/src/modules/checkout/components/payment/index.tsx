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
    // 1. Define the callback FluidPay calls after tokenization
    (window as any).fluidPayCallback = (response: any) => {
      if (response && response.token) {
        console.log("[FluidPay] Token generated:", response.token)
        if (onTokenReceived) {
          onTokenReceived(response.token)
        }
      } else {
        console.error("[FluidPay] Tokenization failed:", response)
      }
    }

    // 2. Global Event Listener: Listens for the "Place Order" button
    const handleTriggerTokenize = () => {
      console.log("[FluidPay] Triggering tokenization via global event...")
      const container = document.getElementById("fluidpay-tokenizer-container")
      if (container && (window as any).FluidPayTokenizer) {
        // This command tells the FluidPay iframe to submit
        (window as any).FluidPayTokenizer.submit()
      }
    }

    window.addEventListener("triggerFluidPayTokenize", handleTriggerTokenize)

    return () => {
      window.removeEventListener("triggerFluidPayTokenize", handleTriggerTokenize)
    }
  }, [onTokenReceived])

  return (
    <>
      {/* Load the official FluidPay script */}
      <Script 
        src={`${srcBaseUrl}/tokenizer/tokenizer.js`} 
        strategy="afterInteractive" 
      />
      
      <div className="mt-4">
        {/* The target container for the FluidPay Iframe */}
        <div 
          id="fluidpay-tokenizer-container" 
          className="min-h-[250px] w-full border rounded-md p-2 bg-white"
          data-public-key={publicKey}
          data-callback="fluidPayCallback"
        >
          {/* Iframe renders here automatically */}
        </div>
      </div>
    </>
  )
}

export default FluidPayTokenizerLoader