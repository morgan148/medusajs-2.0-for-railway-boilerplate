"use client"
import React, { useEffect, useRef } from "react"
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
  const tokenizerRef = useRef<any>(null)

  const initTokenizer = () => {
    // Check if script is loaded and we haven't initialized yet
    if (typeof window !== "undefined" && (window as any).Tokenizer && !tokenizerRef.current) {
      console.log("[FluidPay] Initializing Tokenizer Class...")
      
      try {
        tokenizerRef.current = new (window as any).Tokenizer({
          apikey: publicKey,
          container: "#fluidpay-tokenizer-container",
          url: srcBaseUrl,
          submission: (response: any) => {
            if (response && response.token) {
              console.log("[FluidPay] Token generated:", response.token)
              // Notify the PaymentButton via Global Event
              const event = new CustomEvent("fluidpay_token_received", { detail: response.token })
              window.dispatchEvent(event)
              if (onTokenReceived) onTokenReceived(response.token)
            }
          }
        })
      } catch (err) {
        console.error("[FluidPay] Initialization error:", err)
      }
    }
  }

  useEffect(() => {
    const handleTriggerTokenize = () => {
      if (tokenizerRef.current) {
        console.log("[FluidPay] Submitting from Instance...")
        tokenizerRef.current.submit() // Trigger the iframe submit
      }
    }

    window.addEventListener("triggerFluidPayTokenize", handleTriggerTokenize)
    return () => window.removeEventListener("triggerFluidPayTokenize", handleTriggerTokenize)
  }, [])

  return (
    <>
      <Script 
        src={`${srcBaseUrl}/tokenizer/tokenizer.js`} 
        strategy="afterInteractive"
        onReady={initTokenizer} // Initialize as soon as script is ready
      />
      <div className="mt-4 p-4 border rounded-md bg-white min-h-[220px]">
        <div id="fluidpay-tokenizer-container">
          {/* Iframe will be injected here by the Class */}
        </div>
      </div>
    </>
  )
}

export default FluidPayTokenizerLoader