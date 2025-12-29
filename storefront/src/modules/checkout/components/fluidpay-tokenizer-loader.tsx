"use client"

import { useEffect, useState } from "react"

declare global {
  interface Window {
    Tokenizer?: any
  }
}

type Props = {
  srcBaseUrl: string
}

export default function FluidPayTokenizerLoader({ srcBaseUrl }: Props) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle")
  const [message, setMessage] = useState<string>("")

  useEffect(() => {
    // Normalize base URL (avoid trailing slash issues)
    const base = (srcBaseUrl || "").trim().replace(/\/+$/, "")
    const scriptSrc = `${base}/tokenizer/tokenizer.js`

    if (!base) {
      setStatus("error")
      setMessage("Missing NEXT_PUBLIC_FLUIDPAY_BASE_URL")
      return
    }

    // If already loaded, don't add again
    if (window.Tokenizer) {
      setStatus("loaded")
      setMessage("Tokenizer already present on window")
      return
    }

    // If a script tag already exists (from a prior render), reuse it
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-fp-tokenizer="true"]`
    )

    if (existing) {
      setStatus("loading")
      existing.addEventListener("load", () => {
        setStatus("loaded")
        setMessage("Tokenizer script loaded (existing tag)")
      })
      existing.addEventListener("error", () => {
        setStatus("error")
        setMessage(`Failed loading tokenizer from ${scriptSrc}`)
      })
      return
    }

    setStatus("loading")
    setMessage(`Loading: ${scriptSrc}`)

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
  }, [srcBaseUrl])

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
    </div>
  )
}