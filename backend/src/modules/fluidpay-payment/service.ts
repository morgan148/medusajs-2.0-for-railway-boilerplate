import { 
    AbstractPaymentProvider, 
    PaymentProviderError, 
    PaymentProviderSessionResponse, 
    PaymentProviderContext,
    GatewayAuthorizePaymentRes,
    ProviderCapturePaymentPayload,
    ProviderRefundPaymentPayload
  } from "@medusajs/framework/utils"
  
  type FluidPayOptions = {
    baseUrl?: string
    secretKey: string
  }
  
  class FluidPayProviderService extends AbstractPaymentProvider {
    static identifier = "fluidpay"
    protected options_: FluidPayOptions
  
    constructor(container: any, options: FluidPayOptions) {
      super(container, options)
      this.options_ = options
    }
  
    private getApiUrl() {
      return process.env.FLUIDPAY_API_URL || "https://sandbox.fluidpay.com/api"
    }
  
    async initiatePayment(context: PaymentProviderContext): Promise<PaymentProviderSessionResponse> {
      return {
        data: {
          amount: context.amount,
          currency_code: context.currency_code,
        },
      }
    }
  
    async authorizePayment(
      paymentSessionData: Record<string, any>,
      context: Record<string, any>
    ): Promise<GatewayAuthorizePaymentRes> {
      const token = paymentSessionData?.token
      const apiKey = process.env.FLUIDPAY_SECRET_KEY || this.options_.secretKey
      const baseUrl = this.getApiUrl()
  
      if (!token) {
        return { error: "Missing FluidPay token", code: "missing_token" }
      }
  
      const amountCents = Math.round(context?.amount || paymentSessionData?.amount || 0)
      const currency = (context?.currency_code || "USD").toUpperCase()
  
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
            currency,
            payment_method: { token },
            vault_payment_method: true, 
          }),
        })
  
        const result = await res.json()
  
        if (!res.ok) {
          return {
            error: result?.message || "FluidPay transaction failed",
            code: "transaction_failed"
          }
        }
  
        return {
          status: "captured",
          data: {
            fluidpay_id: result.data?.id,
            fluidpay_vault_id: result.data?.payment_method?.token,
          },
        }
      } catch (e: any) {
        return { error: e.message, code: "connection_error" }
      }
    }
  
    async capturePayment(paymentData: ProviderCapturePaymentPayload): Promise<Record<string, any>> {
      return { status: "captured", data: paymentData }
    }
  
    async refundPayment(paymentData: ProviderRefundPaymentPayload, refundAmount: number): Promise<Record<string, any>> {
      const transactionId = paymentData.fluidpay_id
      const apiKey = process.env.FLUIDPAY_SECRET_KEY || this.options_.secretKey
  
      const res = await fetch(`${this.getApiUrl()}/transaction/${transactionId}/refund`, {
        method: "POST",
        headers: { "Authorization": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: refundAmount }),
      })
      const result = await res.json()
      return { status: "refunded", data: { ...paymentData, refund_result: result } }
    }
  
    async cancelPayment(paymentData: Record<string, any>): Promise<Record<string, any>> {
      const transactionId = paymentData.fluidpay_id
      const apiKey = process.env.FLUIDPAY_SECRET_KEY || this.options_.secretKey
  
      await fetch(`${this.getApiUrl()}/transaction/${transactionId}/void`, {
        method: "POST",
        headers: { "Authorization": apiKey },
      })
      return { status: "cancelled", data: paymentData }
    }
  
    // Required stubs
    async deletePayment(): Promise<Record<string, any>> { return {} }
    async getPaymentStatus(): Promise<string> { return "captured" }
    async retrievePayment(paymentData: Record<string, any>): Promise<Record<string, any>> { return paymentData }
    async updatePayment(): Promise<Record<string, any>> { return {} }
    async updatePaymentData(): Promise<Record<string, any>> { return {} }
  }
  
  export default FluidPayProviderService