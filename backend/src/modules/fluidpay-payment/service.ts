import { AbstractPaymentProvider } from "@medusajs/framework/utils"

type FluidPayOptions = {
  baseUrl?: string
  secretKey: string
}

class FluidPayProviderService extends AbstractPaymentProvider {
  static identifier = "fluidpay"

  private getApiUrl() {
    return process.env.FLUIDPAY_API_URL || "https://sandbox.fluidpay.com/api"
  }

  // Required by Medusa v2 to handle webhooks
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
    const { paymentSessionData, context } = input
    
    // ✅ DEBUG: Log the entire session object to find the missing token
    console.log("*****************************************")
    console.log("FULL SESSION DATA INSPECTION:", JSON.stringify(paymentSessionData, null, 2))
    
    // Look in every possible nested location
    const token = paymentSessionData?.token || 
                  paymentSessionData?.data?.token || 
                  paymentSessionData?.metadata?.token ||
                  paymentSessionData?.fluidpay_token ||
                  (paymentSessionData?.data as any)?.fluidpay_token

    const apiKey = process.env.FLUIDPAY_SECRET_KEY || (this as any).options_.secretKey
    const baseUrl = this.getApiUrl()

    console.log("FLUIDPAY AUTHORIZE ATTEMPT")
    console.log("Cart ID:", context?.cart_id || paymentSessionData?.cart_id)
    console.log("Token Found:", !!token)
    console.log("*****************************************")

    if (!token) {
      return { 
        status: "error", 
        data: paymentSessionData || {}, 
        error: "Missing FluidPay token - check backend logs for FULL SESSION DATA INSPECTION" 
      }
    }

    const amountCents = Math.round(context?.amount || paymentSessionData?.amount || 0)

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
          currency: (context?.currency_code || "USD").toUpperCase(),
          payment_method: { token },
          vault_payment_method: true, 
        }),
      })

      const result = await res.json()
      console.log("[FluidPay API Success Response]:", JSON.stringify(result, null, 2))
      
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
          ...paymentSessionData,
          fluidpay_id: result.data?.id,
          fluidpay_vault_id: result.data?.payment_method?.token,
        },
      }

    } catch (e: any) {
      return { 
        status: "error", 
        data: paymentSessionData || {}, 
        error: e.message 
      }
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