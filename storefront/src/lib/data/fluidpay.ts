"use server"

import { revalidateTag } from "next/cache"

// This project already uses NEXT_PUBLIC_MEDUSA_BACKEND_URL in env.local/template.
// On Railway, you set it in Variables.
const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL

/**
 * Stores FluidPay token on the cart metadata so the backend can use it later
 * when the order is placed / payment is captured.
 */
export async function storeFluidPayTokenOnCart(cartId: string, token: string) {
  if (!BACKEND_URL) {
    throw new Error("NEXT_PUBLIC_MEDUSA_BACKEND_URL is not set")
  }
  if (!cartId) {
    throw new Error("Missing cartId")
  }
  if (!token) {
    throw new Error("Missing FluidPay token")
  }

  const url = `${BACKEND_URL}/store/carts/${cartId}`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Important: includes cookies so Medusa can identify the cart session
      // (this is what usually ties browser session -> cart)
    },
    credentials: "include",
    body: JSON.stringify({
      metadata: {
        fluidpay_token: token,
      },
    }),
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to store token on cart: ${res.status} ${text}`)
  }

  // Your storefront uses caching tags in some places; this keeps UI in sync.
  // Safe even if you don't use it everywhere.
  revalidateTag("cart")

  return res.json()
}