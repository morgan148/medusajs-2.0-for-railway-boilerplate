"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { omit } from "lodash"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { getAuthHeaders, getCartId, removeCartId, setCartId } from "./cookies"
import { getProductsById } from "./products"
import { getRegion } from "./regions"

export async function retrieveCart() {
  const cartId = await getCartId()
  if (!cartId) return null
  const authHeaders = await getAuthHeaders()
  // Merge Next.js cache options with auth headers
  const headers = {
    ...authHeaders,
    next: { tags: ["cart"] }
  }
  return await sdk.store.cart
    .retrieve(cartId, {}, headers)
    .then(({ cart }) => cart)
    .catch(() => null)
}

export async function getOrSetCart(countryCode: string) {
  let cart = await retrieveCart()
  const region = await getRegion(countryCode)
  if (!region) throw new Error(`Region not found for country code: ${countryCode}`)
  if (!cart) {
    const cartResp = await sdk.store.cart.create({ region_id: region.id })
    cart = cartResp.cart
    await setCartId(cart.id)
    revalidateTag("cart")
  }
  if (cart && cart?.region_id !== region.id) {
    await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, await getAuthHeaders())
    revalidateTag("cart")
  }
  return cart
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId()
  if (!cartId) throw new Error("No existing cart found")
  return sdk.store.cart.update(cartId, data, {}, await getAuthHeaders())
    .then(({ cart }) => {
      revalidateTag("cart")
      return cart
    })
    .catch(medusaError)
}

export async function addToCart({ variantId, quantity, countryCode }: { variantId: string, quantity: number, countryCode: string }) {
  const cart = await getOrSetCart(countryCode)
  if (!cart) throw new Error("Error retrieving or creating cart")
  await sdk.store.cart.createLineItem(cart.id, { variant_id: variantId, quantity }, {}, await getAuthHeaders())
    .then(() => revalidateTag("cart"))
    .catch(medusaError)
}

export async function updateLineItem({ lineId, quantity }: { lineId: string, quantity: number }) {
  const cartId = await getCartId()
  if (!cartId) throw new Error("Missing cart ID")
  await sdk.store.cart.updateLineItem(cartId, lineId, { quantity }, {}, await getAuthHeaders())
    .then(() => revalidateTag("cart"))
    .catch(medusaError)
}

export async function deleteLineItem(lineId: string) {
  const cartId = await getCartId()
  if (!cartId) throw new Error("Missing cart ID")
  await sdk.store.cart.deleteLineItem(cartId, lineId, await getAuthHeaders())
    .then(() => revalidateTag("cart"))
    .catch(medusaError)
  revalidateTag("cart")
}

export async function enrichLineItems(lineItems: HttpTypes.StoreCartLineItem[] | HttpTypes.StoreOrderLineItem[] | null, regionId: string) {
  if (!lineItems) return []
  const queryParams = { ids: lineItems.map((lineItem) => lineItem.product_id!), regionId }
  const products = await getProductsById(queryParams)
  if (!lineItems?.length || !products) return []
  return lineItems.map((item) => {
    const product = products.find((p: any) => p.id === item.product_id)
    const variant = product?.variants?.find((v: any) => v.id === item.variant_id)
    if (!product || !variant) return item
    return { ...item, variant: { ...variant, product: omit(product, "variants") } }
  }) as HttpTypes.StoreCartLineItem[]
}

export async function setShippingMethod({ cartId, shippingMethodId }: { cartId: string, shippingMethodId: string }) {
  return sdk.store.cart.addShippingMethod(cartId, { option_id: shippingMethodId }, {}, await getAuthHeaders())
    .then(() => revalidateTag("cart"))
    .catch(medusaError)
}

// ✅ UPDATED: Ensuring the amount is passed so it's available in authorizePayment
export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  data: {
    provider_id: string
    data?: Record<string, unknown>
    context?: Record<string, unknown>
  }
) {
  // Ensure the amount is included in the data object for persistence
  const sessionPayload = {
    ...data,
    data: {
      ...data.data,
      amount: cart.total,
      currency_code: cart.currency_code
    }
  }

  return sdk.store.payment
    .initiatePaymentSession(cart, sessionPayload, {}, await getAuthHeaders())
    .then((resp) => {
      revalidateTag("cart")
      return resp
    })
    .catch(medusaError)
}

export async function placeOrder() {
  const cartId = await getCartId()
  if (!cartId) throw new Error("No cart found")
  const cartRes = await sdk.store.cart.complete(cartId, {}, await getAuthHeaders())
    .then((cartRes) => {
      revalidateTag("cart")
      return cartRes
    })
    .catch(medusaError)

  if (cartRes?.type === "order") {
    const countryCode = cartRes.order.shipping_address?.country_code?.toLowerCase()
    await removeCartId()
    // redirect() throws NEXT_REDIRECT error - this is expected behavior in Next.js
    // The error will be caught by Next.js and handled properly
    redirect(`/${countryCode}/order/confirmed/${cartRes?.order.id}`)
  }
  return cartRes.cart
}

export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId()
  const region = await getRegion(countryCode)
  if (!region) throw new Error("Region not found")
  if (cartId) await updateCart({ region_id: region.id })
  revalidateTag("regions")
  revalidateTag("products")
  redirect(`/${countryCode}${currentPath}`)
}

export async function applyPromotions(codes: string[]) {
  await updateCart({ promo_codes: codes }).then(() => revalidateTag("cart")).catch(medusaError)
}

export async function setAddresses(currentState: unknown, formData: FormData) {
  try {
    const cartId = await getCartId()
    if (!cartId) throw new Error("No cart found")
    const data = {
      shipping_address: {
        first_name: formData.get("shipping_address.first_name"),
        last_name: formData.get("shipping_address.last_name"),
        address_1: formData.get("shipping_address.address_1"),
        address_2: "",
        company: formData.get("shipping_address.company"),
        postal_code: formData.get("shipping_address.postal_code"),
        city: formData.get("shipping_address.city"),
        country_code: formData.get("shipping_address.country_code"),
        province: formData.get("shipping_address.province"),
        phone: formData.get("shipping_address.phone"),
      },
      email: formData.get("email"),
    } as any
    const sameAsBilling = formData.get("same_as_billing")
    if (sameAsBilling === "on") data.billing_address = data.shipping_address
    else data.billing_address = {
        first_name: formData.get("billing_address.first_name"),
        last_name: formData.get("billing_address.last_name"),
        address_1: formData.get("billing_address.address_1"),
        address_2: "",
        company: formData.get("billing_address.company"),
        postal_code: formData.get("billing_address.postal_code"),
        city: formData.get("billing_address.city"),
        country_code: formData.get("billing_address.country_code"),
        province: formData.get("billing_address.province"),
        phone: formData.get("billing_address.phone"),
    }
    await updateCart(data)
  } catch (e: any) { return e.message }
  redirect(`/${formData.get("shipping_address.country_code")}/checkout?step=delivery`)
}