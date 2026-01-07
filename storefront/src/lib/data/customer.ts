// storefront/src/lib/data/customer.ts
"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { cache } from "react"
import { getAuthHeaders, removeAuthToken, setAuthToken } from "./cookies"

// Don't use cache() here because it caches based on function signature, not cookies
// This means if called before login, it would cache null and return that after login
export const getCustomer = async function () {
  const authHeaders = await getAuthHeaders()
  
  // Debug logging in development
  if (process.env.NODE_ENV === "development") {
    console.log("[getCustomer] Headers:", {
      hasAuth: !!authHeaders.authorization,
      hasCookie: !!authHeaders.cookie,
      cookiePreview: authHeaders.cookie?.substring(0, 50) || "none",
    })
  }
  
  return await sdk.store.customer
    .retrieve({}, authHeaders)
    .then(({ customer }) => customer)
    .catch((err) => {
      // Log error in development to help debug
      if (process.env.NODE_ENV === "development") {
        console.error("[getCustomer] Error:", err.message, "Status:", err.response?.status, "Headers sent:", {
          hasAuth: !!authHeaders.authorization,
          hasCookie: !!authHeaders.cookie,
        })
      }
      return null
    })
}

export const updateCustomer = cache(async function (
  body: HttpTypes.StoreUpdateCustomer
) {
  const updateRes = await sdk.store.customer
    .update(body, {}, await getAuthHeaders())
    .then(({ customer }) => customer)
    .catch(medusaError)

  revalidateTag("customer")
  return updateRes
})

export async function signup(_currentState: unknown, formData: FormData) {
  const password = formData.get("password") as string
  const customerForm = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: formData.get("phone") as string,
  }

  try {
    const token = await sdk.auth.register("customer", "emailpass", {
      email: customerForm.email,
      password: password,
    })

    const customHeaders = { authorization: `Bearer ${token}` }

    const { customer: createdCustomer } = await sdk.store.customer.create(
      customerForm,
      {},
      customHeaders
    )

    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email: customerForm.email,
      password,
    })

    await setAuthToken(typeof loginToken === "string" ? loginToken : loginToken.location)

    revalidateTag("customer")
    return createdCustomer
  } catch (error: any) {
    return error.toString()
  }
}

export async function login(_currentState: unknown, formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  try {
    const loginResult = await sdk.auth.login("customer", "emailpass", { email, password })
    const token = typeof loginResult === "string" ? loginResult : loginResult.location
    
    // Set the cookie - this will be in the response headers
    await setAuthToken(token)
    
    // Revalidate tags to ensure fresh data after login
    revalidateTag("customer")
    revalidateTag("auth")
    
    // Get country code from headers to build proper redirect URL
    const { headers } = await import("next/headers")
    const headersList = await headers()
    const referer = headersList.get("referer") || ""
    // Extract country code from referer URL (e.g., /us/account/login -> us)
    const countryCodeMatch = referer.match(/\/([a-z]{2})\//)
    const countryCode = countryCodeMatch ? countryCodeMatch[1] : "us"
    
    // Use redirect() - the cookie is set in the response, so it will be available
    // in the next request after the redirect completes
    redirect(`/${countryCode}/account`)
  } catch (error: any) {
    // If it's a redirect error, that's expected - don't catch it
    if (error?.message?.includes("NEXT_REDIRECT") || error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error
    }
    return { success: false, error: error.toString() }
  }
}

export async function signout(countryCode: string) {
  await sdk.auth.logout()
  await removeAuthToken()
  revalidateTag("auth")
  revalidateTag("customer")
  redirect(`/${countryCode}/account`)
}

export const addCustomerAddress = async (
  _currentState: unknown,
  formData: FormData
): Promise<any> => {
  // Helper to get form value, checking both direct and prefixed field names
  const getFormValue = (fieldName: string): string => {
    return (
      (formData.get(fieldName) ||
        formData.get(`billing_address.${fieldName}`) ||
        formData.get(`shipping_address.${fieldName}`) ||
        "") as string
    )
  }

  // Determine if this is a billing or shipping address based on form field prefix
  const isBillingAddress = !!formData.get("billing_address.first_name")
  const isShippingAddress = !!formData.get("shipping_address.first_name")

  const address: any = {
    first_name: getFormValue("first_name"),
    last_name: getFormValue("last_name"),
    company: getFormValue("company"),
    address_1: getFormValue("address_1"),
    address_2: getFormValue("address_2"),
    city: getFormValue("city"),
    postal_code: getFormValue("postal_code"),
    province: getFormValue("province"),
    country_code: getFormValue("country_code"),
    phone: getFormValue("phone"),
  }

  // Set default flags based on address type
  if (isBillingAddress) {
    address.is_default_billing = true
  }
  if (isShippingAddress) {
    address.is_default_shipping = true
  }

  // For billing address idempotency: remove default billing from other addresses
  if (isBillingAddress) {
    try {
      // Fetch customer directly to avoid cache issues
      const { customer } = await sdk.store.customer.retrieve({}, await getAuthHeaders())
      if (customer?.addresses) {
        // Find existing default billing address
        const existingDefaultBilling = customer.addresses.find(
          (addr) => addr.is_default_billing
        )
        
        // If one exists, remove the default flag before creating new one
        if (existingDefaultBilling) {
          await sdk.store.customer
            .updateAddress(
              existingDefaultBilling.id,
              { is_default_billing: false },
              {},
              await getAuthHeaders()
            )
            .catch(() => {
              // Ignore errors - address might not exist anymore
            })
        }
      }
    } catch (err) {
      // Ignore errors - continue with address creation
    }
  }

  return sdk.store.customer
    .createAddress(address, {}, await getAuthHeaders())
    .then(() => {
      revalidateTag("customer")
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const deleteCustomerAddress = async (addressId: string): Promise<void> => {
  await sdk.store.customer
    .deleteAddress(addressId, await getAuthHeaders())
    .then(() => {
      revalidateTag("customer")
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const addressId = currentState.addressId as string

  if (!addressId) {
    return { success: false, error: "Address ID is required" }
  }

  // Helper to get form value, checking both direct and prefixed field names
  const getFormValue = (fieldName: string): string => {
    return (
      (formData.get(fieldName) ||
        formData.get(`billing_address.${fieldName}`) ||
        formData.get(`shipping_address.${fieldName}`) ||
        "") as string
    )
  }

  // Determine if this is a billing or shipping address based on form field prefix
  const isBillingAddress = !!formData.get("billing_address.first_name")
  const isShippingAddress = !!formData.get("shipping_address.first_name")

  const address: any = {
    first_name: getFormValue("first_name"),
    last_name: getFormValue("last_name"),
    company: getFormValue("company"),
    address_1: getFormValue("address_1"),
    address_2: getFormValue("address_2"),
    city: getFormValue("city"),
    postal_code: getFormValue("postal_code"),
    province: getFormValue("province"),
    country_code: getFormValue("country_code"),
    phone: getFormValue("phone"),
  }

  // Set default flags based on address type
  if (isBillingAddress) {
    address.is_default_billing = true
    
    // For billing address idempotency: remove default billing from other addresses
    try {
      // Fetch customer directly to avoid cache issues
      const { customer } = await sdk.store.customer.retrieve({}, await getAuthHeaders())
      if (customer?.addresses) {
        const existingDefaultBilling = customer.addresses.find(
          (addr) => addr.is_default_billing && addr.id !== addressId
        )
        
        if (existingDefaultBilling) {
          await sdk.store.customer
            .updateAddress(
              existingDefaultBilling.id,
              { is_default_billing: false },
              {},
              await getAuthHeaders()
            )
            .catch(() => {
              // Ignore errors
            })
        }
      }
    } catch (err) {
      // Ignore errors - continue with address update
    }
  }
  
  if (isShippingAddress) {
    address.is_default_shipping = true
  }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, await getAuthHeaders())
    .then(() => {
      revalidateTag("customer")
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}