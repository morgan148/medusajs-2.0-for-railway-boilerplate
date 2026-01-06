// storefront/src/lib/data/customer.ts
"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { cache } from "react"
import { getAuthHeaders, removeAuthToken, setAuthToken } from "./cookies"

export const getCustomer = cache(async function () {
  const authHeaders = await getAuthHeaders()
  // Spread headers into options object like cart.retrieve does
  return await sdk.store.customer
    .retrieve({}, { ...authHeaders } as any)
    .then(({ customer }) => customer)
    .catch((err) => {
      // Log error in development to help debug
      if (process.env.NODE_ENV === "development") {
        console.error("[getCustomer] Error:", err.message, "Headers sent:", authHeaders)
      }
      return null
    })
})

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
    await sdk.auth
      .login("customer", "emailpass", { email, password })
      .then(async (token) => {
        await setAuthToken(typeof token === "string" ? token : token.location)
        revalidateTag("customer")
      })
  } catch (error: any) {
    return error.toString()
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

  const address = {
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

  const address = {
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