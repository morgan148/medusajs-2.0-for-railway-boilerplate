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

  async authorizePayment(input: any): Promise<any> {
    // 1. INSPECT THE INPUT
    console.log("*****************************************")
    console.log("CRITICAL INPUT INSPECTION:", JSON.stringify(input, null, 2))
    
    const sessionData = input?.paymentSessionData || input || {}
    const context = input?.context || {}

    // 2. SEARCH FOR TOKEN
    const token = sessionData?.token || 
                  sessionData?.data?.token || 
                  sessionData?.metadata?.token ||
                  sessionData?.fluidpay_token

    // 3. FIX: PULL AMOUNT FROM SESSION DATA IF CONTEXT IS EMPTY
    const rawAmount = context?.amount || sessionData?.amount || sessionData?.data?.amount || 0
    const amountCents = Math.round(Number(rawAmount))

    const apiKey = process.env.FLUIDPAY_SECRET_KEY || (this as any).options_.secretKey
    const baseUrl = this.getApiUrl()

    console.log("Token Extracted:", !!token)
    console.log("Amount in Cents:", amountCents)
    console.log("*****************************************")

    // Early exit if amount is 0 to avoid FluidPay 400 error
    if (amountCents <= 0) {
      return { 
        status: "error", 
        data: sessionData || {}, 
        error: `Invalid amount: ${amountCents}. Medusa did not provide a total.` 
      }
    }

    if (!token) {
      return { 
        status: "error", 
        data: sessionData || {}, 
        error: "Missing FluidPay token." 
      }
    }

    try {
      const res = await fetch(`${baseUrl}/transaction`, {
        method: "POST",
        headers: {
          "Authorization": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "sale", 
          amount: amountCents,
          currency: (context?.currency_code || sessionData?.currency_code || "USD").toUpperCase(),
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