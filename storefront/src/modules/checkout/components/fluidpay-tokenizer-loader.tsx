"use client"
import React, { useEffect } from "react"
import Script from "next/script"

type Props = {
  srcBaseUrl: string
  publicKey: string
  cartId: string
  onTokenReceived?: (token: string) => void // Callback to enable the button
}

const FluidPayTokenizerLoader: React.FC<Props> = ({ 
  srcBaseUrl, 
  publicKey, 
  onTokenReceived 
}) => {
  useEffect(() => {
    // This function must be globally accessible for the FluidPay script to call it
    (window as any).fluidPayCallback = (response: any) => {
      if (response && response.token) {
        console.log("FluidPay Token Received:", response.token)
        if (onTokenReceived) onTokenReceived(response.token)
      }
    }
  }, [onTokenReceived])

  return (
    <>
      <Script 
        src={`${srcBaseUrl}/tokenizer/tokenizer.js`} 
        strategy="afterInteractive" 
      />
      <div className="mt-4 p-4 border rounded-md bg-gray-50">
        <div 
          id="fluidpay-tokenizer-container" 
          data-public-key={publicKey}
          data-callback="fluidPayCallback"
          // Add other FluidPay data attributes here (styles, etc.)
        >
          {/* FluidPay iframe renders here */}
        </div>
      </div>
    </>
  )
}

export default FluidPayTokenizerLoader