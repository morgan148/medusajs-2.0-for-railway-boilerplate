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

  // Consolidated to a single 'input' object to match your base type error
  async authorizePayment(input: any): Promise<any> {
    const { paymentSessionData, context } = input
    const token = paymentSessionData?.token
    const apiKey = process.env.FLUIDPAY_SECRET_KEY || (this as any).options_.secretKey
    const baseUrl = this.getApiUrl()

    if (!token) {
      return { error: "Missing FluidPay token", code: "missing_token" }
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
      if (!res.ok) return { error: result?.message || "Failed" }

      return {
        status: "captured",
        data: {
          fluidpay_id: result.data?.id,
          fluidpay_vault_id: result.data?.payment_method?.token,
        },
      }
    } catch (e: any) {
      return { error: e.message }
    }
  }

  async capturePayment(input: any): Promise<any> {
    return { status: "captured", data: input.paymentData }
  }

  async refundPayment(input: any): Promise<any> {
    const { paymentData, amount } = input
    const transactionId = paymentData.fluidpay_id
    const apiKey = process.env.FLUIDPAY_SECRET_KEY || (this as any).options_.secretKey

    const res = await fetch(`${this.getApiUrl()}/transaction/${transactionId}/refund`, {
      method: "POST",
      headers: { "Authorization": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    })
    const result = await res.json()
    return { status: "refunded", data: { ...paymentData, refund_result: result } }
  }

  async cancelPayment(input: any): Promise<any> {
    const transactionId = input.paymentData.fluidpay_id
    await fetch(`${this.getApiUrl()}/transaction/${transactionId}/void`, {
      method: "POST",
      headers: { "Authorization": process.env.FLUIDPAY_SECRET_KEY || (this as any).options_.secretKey },
    })
    return { status: "cancelled", data: input.paymentData }
  }

  async deletePayment(): Promise<any> { return {} }
  async getPaymentStatus(input: any): Promise<any> { return { status: "captured" } }
  async retrievePayment(input: any): Promise<any> { return input.paymentData }
  async updatePayment(): Promise<any> { return {} }
  async updatePaymentData(): Promise<any> { return {} }
}

export default FluidPayProviderService