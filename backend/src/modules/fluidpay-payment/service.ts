import { AbstractPaymentProvider } from "@medusajs/framework/utils"

class FluidPayProviderService extends AbstractPaymentProvider {
  static identifier = "fluidpay"

  private getApiUrl() {
    return process.env.FLUIDPAY_API_URL || "https://sandbox.fluidpay.com/api"
  }

  async getWebhookActionAndData(data: any): Promise<any> {
    return { action: "not_supported", data: {} }
  }

  async initiatePayment(input: any): Promise<any> {
    return {
      data: {
        amount: input.amount,
        currency_code: input.currency_code,
      },
    }
  }

  // Refined to catch data regardless of the Medusa version structure
  async authorizePayment(input: any): Promise<any> {
    // 1. INSPECT THE ENTIRE INPUT OBJECT
    console.log("*****************************************")
    console.log("CRITICAL INPUT INSPECTION:", JSON.stringify(input, null, 2))
    
    // Some versions pass (sessionData, context), others pass { paymentSessionData, context }
    const sessionData = input?.paymentSessionData || input || {}
    const context = input?.context || {}

    // 2. SEARCH EVERYWHERE FOR THE TOKEN
    const token = sessionData?.token || 
                  sessionData?.data?.token || 
                  sessionData?.metadata?.token ||
                  sessionData?.fluidpay_token ||
                  (sessionData as any)?.data?.fluidpay_token

    const apiKey = process.env.FLUIDPAY_SECRET_KEY || (this as any).options_.secretKey
    const baseUrl = this.getApiUrl()

    console.log("Cart ID:", context?.cart_id || sessionData?.cart_id)
    console.log("Token Extracted:", !!token)
    console.log("*****************************************")

    if (!token) {
      // Return status error to stop the order, but provide data to avoid crash
      return { 
        status: "error", 
        data: sessionData || {}, 
        error: "Missing FluidPay token. Check 'CRITICAL INPUT INSPECTION' in logs." 
      }
    }

    try {
      const amountCents = Math.round(context?.amount || sessionData?.amount || 0)
      const res = await fetch(`${baseUrl}/transaction`, {
        method: "POST",
        headers: {
          "Authorization": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "sale", 
          amount: amountCents,
          currency: (context?.currency_code || "USD").toUpperCase(),
          payment_method: { token },
          vault_payment_method: true, 
        }),
      })

      const result = await res.json()
      console.log("[FluidPay API Response]:", JSON.stringify(result, null, 2))
      
      if (!res.ok) {
        return { 
          status: "error", 
          data: result?.data || result || {}, 
          error: result?.msg || result?.message || "FluidPay transaction failed"
        }
      }

      // Format response exactly as Medusa 2.0 expects
      return {
        status: "captured",
        data: {
          ...sessionData,
          fluidpay_id: result.data?.id,
          fluidpay_vault_id: result.data?.payment_method?.token,
        },
      }
    } catch (e: any) {
      console.error("[FluidPay Global Catch]:", e.message)
      return { status: "error", data: sessionData || {}, error: e.message }
    }
  }

  async capturePayment(input: any): Promise<any> { return { status: "captured", data: input.paymentData } }
  async refundPayment(input: any): Promise<any> { return { status: "refunded", data: input.paymentData } }
  async cancelPayment(input: any): Promise<any> { return { status: "cancelled", data: input.paymentData } }
  async deletePayment(): Promise<any> { return {} }
  async getPaymentStatus(input: any): Promise<any> { return { status: "captured" } }
  async retrievePayment(input: any): Promise<any> { return input.paymentData }
  async updatePayment(): Promise<any> { return {} }
  async updatePaymentData(): Promise<any> { return {} }
}

export default FluidPayProviderService