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
    const sessionData = paymentSessionData || input || {}
    
    // Search for the secure token
    const token = sessionData?.token || 
                  sessionData?.data?.token || 
                  sessionData?.metadata?.token ||
                  sessionData?.fluidpay_token

    // ✅ FIX: Convert dollar value (25) to cents (2500)
    const rawAmount = context?.amount || sessionData?.amount || sessionData?.data?.amount || 0;
    const amountCents = Math.round(Number(rawAmount) * 100); 

    const apiKey = process.env.FLUIDPAY_SECRET_KEY || (this as any).options_.secretKey;
    const baseUrl = this.getApiUrl();

    // Verify values before hitting the API
    console.log("Processing Amount in Cents:", amountCents);

    if (!token || amountCents <= 0) {
      return { 
        status: "error", 
        data: sessionData, 
        error: !token ? "Missing payment token" : `Invalid amount: ${amountCents}` 
      };
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
      
      if (!res.ok) {
        return { 
          status: "error", 
          data: result?.data || result, 
          error: result?.msg || result?.message || "Transaction failed"
        }
      }

      // Success: Return 'captured' status for sale transactions
      return {
        status: "captured",
        data: {
          ...sessionData,
          fluidpay_id: result.data?.id,
          fluidpay_vault_id: result.data?.payment_method?.token,
        },
      }
    } catch (e: any) {
      return { status: "error", data: sessionData, error: e.message }
    }
  }

  async capturePayment(input: any): Promise<any> { return { status: "captured", data: input.paymentData } }
  async refundPayment(input: any): Promise<any> { 
    const transactionId = input.paymentData.fluidpay_id;
    const apiKey = process.env.FLUIDPAY_SECRET_KEY || (this as any).options_.secretKey;
    const res = await fetch(`${this.getApiUrl()}/transaction/${transactionId}/refund`, {
      method: "POST",
      headers: { "Authorization": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: input.amount }),
    });
    const result = await res.json();
    return { status: "refunded", data: { ...input.paymentData, refund_result: result } };
  }
  async cancelPayment(input: any): Promise<any> { 
    const transactionId = input.paymentData.fluidpay_id;
    const apiKey = process.env.FLUIDPAY_SECRET_KEY || (this as any).options_.secretKey;
    await fetch(`${this.getApiUrl()}/transaction/${transactionId}/void`, {
      method: "POST",
      headers: { "Authorization": apiKey },
    });
    return { status: "cancelled", data: input.paymentData };
  }
  async deletePayment(): Promise<any> { return {} }
  async getPaymentStatus(input: any): Promise<any> { return { status: "captured" } }
  async retrievePayment(input: any): Promise<any> { return input.paymentData }
  async updatePayment(): Promise<any> { return {} }
  async updatePaymentData(): Promise<any> { return {} }
}

export default FluidPayProviderService