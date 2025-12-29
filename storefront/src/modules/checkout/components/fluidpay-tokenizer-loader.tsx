"use client"

import { useEffect, useMemo, useState } from "react"

declare global {
  interface Window {
    Tokenizer?: any
    __fpTokenizerInstance?: any
  }
}

type Props = {
  srcBaseUrl: string // ex: https://sandbox.fluidpay.com
  publicKey?: string // optional override, otherwise read from env
  onToken?: (token: string, rawResponse?: any) => void
}

export default function FluidPayTokenizerLoader({
  srcBaseUrl,
  publicKey,
  onToken,
}: Props) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "loaded" | "error" | "ready"
  >("idle")
  const [message, setMessage] = useState<string>("")

  const resolvedKey =
    publicKey || process.env.NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY || ""

  const scriptSrc = useMemo(() => {
    const base = (srcBaseUrl || "").replace(/\/$/, "")
    return `${base}/tokenizer/tokenizer.js`
  }, [srcBaseUrl])

  useEffect(() => {
    // Basic guard rails
    if (!srcBaseUrl) {
      setStatus("error")
      setMessage("Missing NEXT_PUBLIC_FLUIDPAY_BASE_URL")
      return
    }
    if (!resolvedKey) {
      setStatus("error")
      setMessage("Missing NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY")
      return
    }

    setStatus("loading")
    setMessage(`Loading: ${scriptSrc}`)

    // If script already exists, don't add it again
    const existing = document.querySelector(
      'script[data-fp-tokenizer="true"]'
    ) as HTMLScriptElement | null

    const loadScript = () =>
      new Promise<void>((resolve, reject) => {
        if (existing) return resolve()

        const script = document.createElement("script")
        script.src = scriptSrc
        script.async = true
        script.defer = true
        script.dataset.fpTokenizer = "true"

        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Failed loading ${scriptSrc}`))

        document.head.appendChild(script)
      })

    const setupTokenizer = async () => {
      try {
        await loadScript()
        setStatus("loaded")
        setMessage("Tokenizer script loaded")

        // Wait for window.Tokenizer to exist (sometimes it’s not immediate)
        const started = Date.now()
        while (!window.Tokenizer) {
          if (Date.now() - started > 4000) {
            throw new Error("Tokenizer global not found on window")
          }
          await new Promise((r) => setTimeout(r, 50))
        }

        // Create instance once (avoid duplicates on re-render)
        if (!window.__fpTokenizerInstance) {
          window.__fpTokenizerInstance = new window.Tokenizer({
            url: srcBaseUrl, // docs: optional, but we set it explicitly
            apikey: resolvedKey,
            container: "#fp-tokenizer-container",
            submission: (resp: any) => {
              // resp structure depends on FluidPay; we’ll extract the token defensively
              const token =
                resp?.token ||
                resp?.data?.token ||
                resp?.payment_token ||
                resp?.data?.payment_token

              console.log("FluidPay Tokenizer submission response:", resp)
              if (token) {
                console.log("FluidPay token:", token)
                onToken?.(token, resp)
              }
            },
          })
        }

        setStatus("ready")
        setMessage("Tokenizer ready (iframe should be visible below)")
      } catch (e: any) {
        setStatus("error")
        setMessage(e?.message || "Tokenizer failed to initialize")
      }
    }

    setupTokenizer()
  }, [scriptSrc, srcBaseUrl, resolvedKey, onToken])

  return (
    <div className="mt-3 text-sm">
      <div className="font-medium">FluidPay Tokenizer</div>
      <div>
        Status:{" "}
        <span className="font-mono">
          {status}
        </span>
      </div>
      {message ? <div className="text-ui-fg-subtle">{message}</div> : null}

      {/* Tokenizer iframe mounts here */}
      <div
        id="fp-tokenizer-container"
        className="mt-3 rounded-md border border-ui-border-base p-3 bg-ui-bg-field"
      />
    </div>
  )
}