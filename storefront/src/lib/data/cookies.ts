// storefront/src/lib/data/cookies.ts
import "server-only"
import { cookies } from "next/headers"

/**
 * List of Medusa-related cookie names that should be forwarded to the backend.
 * Only these cookies are forwarded to avoid:
 * - Hitting HTTP header size limits (typically 8-16KB)
 * - Security concerns with forwarding unnecessary cookies
 * - Performance issues with large headers
 */
const MEDUSA_COOKIE_NAMES = [
  '_medusa_jwt',        // Authentication token
  '_medusa_cart_id',    // Cart session ID
  '_medusa_onboarding', // Onboarding state (if used)
] as const

/**
 * Gets only Medusa-related cookies from the Next.js request and formats them as a Cookie header string.
 * This filters out unnecessary cookies (analytics, third-party, etc.) to:
 * - Prevent hitting HTTP header size limits
 * - Improve security by not forwarding unrelated cookies
 * - Reduce bandwidth and improve performance
 */
export const getCookieHeader = async (): Promise<string> => {
  const cookiesStore = await cookies()
  const cookiePairs: string[] = []
  
  // Only forward Medusa-related cookies
  cookiesStore.getAll().forEach((cookie) => {
    if (MEDUSA_COOKIE_NAMES.includes(cookie.name as any)) {
      cookiePairs.push(`${cookie.name}=${cookie.value}`)
    }
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
  
  // Debug logging in development
  if (process.env.NODE_ENV === "development") {
    console.log("[getAuthHeaders] Generated headers:", {
      hasAuth: !!headers.authorization,
      hasCookie: !!headers.cookie,
      cookieLength: headers.cookie?.length || 0,
      cookiePreview: headers.cookie?.substring(0, 50) + "..." || "none",
    })
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