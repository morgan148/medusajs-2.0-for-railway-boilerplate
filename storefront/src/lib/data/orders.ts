// storefront/src/lib/data/orders.ts
"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { cache } from "react"
import { getAuthHeaders } from "./cookies"

export const retrieveOrder = cache(async function (id: string) {
  const authHeaders = await getAuthHeaders()
  return sdk.store.order
    .retrieve(
      id,
      { fields: "*payment_collections.payments", ...authHeaders } as any
    )
    .then(({ order }) => order)
    .catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[retrieveOrder] Error:", err.message, "Headers sent:", authHeaders)
      }
      return medusaError(err)
    })
})

export const listOrders = cache(async function (
  limit: number = 10,
  offset: number = 0
) {
  const authHeaders = await getAuthHeaders()
  return sdk.store.order
    .list({ limit, offset }, { ...authHeaders } as any)
    .then(({ orders }) => orders)
    .catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[listOrders] Error:", err.message, "Headers sent:", authHeaders)
      }
      return medusaError(err)
    })
})