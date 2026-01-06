// storefront/src/lib/data/cookies.ts
import "server-only"
import { cookies } from "next/headers"

/**
 * Gets all cookies from the Next.js request and formats them as a Cookie header string.
 * This is needed to forward cookies from the browser to the backend when making server-side requests.
 */
export const getCookieHeader = async (): Promise<string> => {
  const cookiesStore = await cookies()
  const cookiePairs: string[] = []
  
  cookiesStore.getAll().forEach((cookie) => {
    cookiePairs.push(`${cookie.name}=${cookie.value}`)
  })
  
  return cookiePairs.join("; ")
}

/**
 * Gets authentication headers including both Authorization (JWT) and Cookie headers.
 * The Cookie header forwards all cookies from the browser request to the backend,
 * which is essential for session-based authentication in server-side contexts.
 */
export const getAuthHeaders = async (): Promise<{ 
  authorization?: string
  cookie?: string
}> => {
  const cookiesStore = await cookies()
  const token = cookiesStore.get("_medusa_jwt")?.value
  const cookieHeader = await getCookieHeader()
  
  const headers: { authorization?: string; cookie?: string } = {}
  
  if (token) {
    headers.authorization = `Bearer ${token}`
  }
  
  // Always include Cookie header to forward all cookies to the backend
  // This is critical for session-based auth when making requests from Server Actions
  // Using lowercase 'cookie' as some HTTP clients are case-sensitive
  if (cookieHeader) {
    headers.cookie = cookieHeader
  }
  
  return headers
}

export const setAuthToken = async (token: string) => {
  const cookiesStore = await cookies()
  cookiesStore.set("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeAuthToken = async () => {
  const cookiesStore = await cookies()
  cookiesStore.set("_medusa_jwt", "", {
    maxAge: -1,
  })
}

export const getCartId = async () => {
  const cookiesStore = await cookies()
  return cookiesStore.get("_medusa_cart_id")?.value
}

export const setCartId = async (cartId: string) => {
  const cookiesStore = await cookies()
  cookiesStore.set("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeCartId = async () => {
  const cookiesStore = await cookies()
  cookiesStore.set("_medusa_cart_id", "", { maxAge: -1 })
}