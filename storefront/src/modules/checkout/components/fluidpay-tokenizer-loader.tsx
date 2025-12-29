"use client"

import { useEffect, useMemo, useState } from "react"
import { storeFluidPayTokenOnCart } from "@lib/data/fluidpay"

type Props = {
  srcBaseUrl: string
  cartId: string
  publicKey: string
}

function extractToken(resp: any): string | null {
  // We don’t want to guess wrong; we try common shapes and fall back to null.
  // After you see the exact response in console once, we can tighten this.
  return (
    resp?.token ||
    resp?.data?.token ||
    resp?.payment_token ||
    resp?.data?.payment_token ||
    resp?.id ||
    resp?.data?.id ||
    null
  )
}

export default function FluidPayTokenizerLoader({
  srcBaseUrl,
  cartId,
  publicKey,
}: Props) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "loaded" | "ready" | "saving" | "saved" | "error"
  >("idle")
  const [message, setMessage] = useState<string>("")

  const scriptSrc = useMemo(() => {
    // FluidPay tokenizer script URL pattern from your network screenshot:
    // https://sandbox.fluidpay.com/tokenizer/tokenizer.js
    // So srcBaseUrl should be "https://sandbox.fluidpay.com"
    return `${srcBaseUrl.replace(/\/$/, "")}/tokenizer/tokenizer.js`
  }, [srcBaseUrl])

  useEffect(() => {
    if (!srcBaseUrl || !cartId || !publicKey) {
      setStatus("error")
      setMessage("Missing srcBaseUrl, cartId, or publicKey")
      return
    }

    setStatus("loading")
    setMessage(`Loading: ${scriptSrc}`)

    // Avoid loading the script multiple times
    const existing = document.querySelector('script[data-fp-tokenizer="true"]')
    if (!existing) {
      const script = document.createElement("script")
      script.src = scriptSrc
      script.async = true
      script.defer = true
      script.dataset.fpTokenizer = "true"

      script.onload = () => {
        setStatus("loaded")
        setMessage("Tokenizer script loaded")
      }

      script.onerror = () => {
        setStatus("error")
        setMessage(`Failed loading tokenizer from ${scriptSrc}`)
      }

      document.head.appendChild(script)
    } else {
      setStatus("loaded")
      setMessage("Tokenizer script already loaded")
    }
  }, [srcBaseUrl, cartId, publicKey, scriptSrc])

  useEffect(() => {
    if (status !== "loaded") return

    const w = window as any
    if (!w.Tokenizer) {
      setStatus("error")
      setMessage("Tokenizer global not found on window")
      return
    }

    setStatus("ready")
    setMessage("Tokenizer ready (iframe should be visible below)")

    // Mount tokenizer iframe into #fp-tokenizer-container
    const instance = new w.Tokenizer({
      url: srcBaseUrl, // docs say optional; safe to pass
      apikey: publicKey,
      container: "#fp-tokenizer-container",
      submission: async (resp: any) => {
        try {
          // Keep this temporarily until you confirm exact token field
          console.log("FluidPay submission response:", resp)

          const token = extractToken(resp)
          if (!token) {
            throw new Error("Could not find token in tokenizer response")
          }

          setStatus("saving")
          setMessage("Saving token to cart...")

          await storeFluidPayTokenOnCart(cartId, token)

          setStatus("saved")
          setMessage("Token saved to cart")
        } catch (e: any) {
          setStatus("error")
          setMessage(e?.message || "Failed saving token")
        }
      },
    })

    // Optional: if you need a reference later:
    w.__fpTokenizer = instance
  }, [status, srcBaseUrl, cartId, publicKey])

  return <div id="fp-tokenizer-container" className="mt-3" />
}