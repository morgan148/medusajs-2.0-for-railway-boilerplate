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
export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const cookiesStore = await cookies()
  const token = cookiesStore.get("_medusa_jwt")?.value
  const cookieHeader = await getCookieHeader()
  
  const headers: Record<string, string> = {}
  
  if (token) {
    // Use lowercase key - SDK will handle HTTP header capitalization
    headers.authorization = `Bearer ${token}`
  }
  
  // Build cookie header - always include the JWT token if we have it
  const cookiePairs: string[] = []
  if (token) {
    cookiePairs.push(`_medusa_jwt=${token}`)
  }
  // Add other Medusa cookies from getCookieHeader (cart_id, etc.)
  if (cookieHeader) {
    // Parse existing cookie header and add non-JWT cookies
    cookieHeader.split("; ").forEach((pair) => {
      if (!pair.startsWith("_medusa_jwt=")) {
        cookiePairs.push(pair)
      }
    })
  }
  
  // Always include Cookie header if we have any cookies
  if (cookiePairs.length > 0) {
    headers.cookie = cookiePairs.join("; ")
  }
  
  // Debug logging in development
  if (process.env.NODE_ENV === "development") {
    console.log("[getAuthHeaders] Generated headers:", {
      hasAuth: !!headers.authorization,
      hasCookie: !!headers.cookie,
      cookieLength: headers.cookie?.length || 0,
      cookiePreview: headers.cookie?.substring(0, 100) || "none",
      tokenFromCookie: !!token,
      tokenPreview: token ? token.substring(0, 20) + "..." : "none",
      allCookies: (await cookies()).getAll().map(c => c.name),
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