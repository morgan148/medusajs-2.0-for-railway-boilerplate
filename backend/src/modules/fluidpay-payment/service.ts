import {
    AbstractPaymentProvider,
    AuthorizePaymentInput,
    AuthorizePaymentOutput,
    CapturePaymentInput,
    CapturePaymentOutput,
    RefundPaymentInput,
    RefundPaymentOutput,
    UpdatePaymentInput,
    UpdatePaymentOutput,
    CancelPaymentInput,
    CancelPaymentOutput,
    GetWebhookActionAndDataInput,
    WebhookActionResult,
  } from "@medusajs/framework"
  
  type FluidPayOptions = {
    baseUrl?: string
    secretKey: string
  }
  
  export default class FluidPayPaymentProviderService
    extends AbstractPaymentProvider<Record<string, unknown>> {
  
    static identifier = "fluidpay"
  
    protected options_: FluidPayOptions
  
    constructor(container, options: FluidPayOptions) {
      super(container, options)
      this.options_ = options
    }
  
    /**
     * AUTHORIZE + CAPTURE (IMMEDIATE)
     */
    async authorizePayment(
      input: AuthorizePaymentInput
    ): Promise<AuthorizePaymentOutput> {
      const { amount, currency_code, payment_session } = input
  
      // token was created client-side by tokenizer
      const token = payment_session.data?.token
  
      if (!token) {
        throw new Error("FluidPay token missing from payment session")
      }
  
      /**
       * TODO:
       * Call FluidPay Tokenizer Customer Payment API here
       * https://sandbox.fluidpay.com/docs/workflows/tokenizer-customer-payment
       */
  
      // Simulated success response
      const transactionId = `fp_${Date.now()}`
  
      return {
        status: "captured", // 👈 authorize + capture immediately
        data: {
          transaction_id: transactionId,
          amount,
          currency_code,
        },
      }
    }
  
    async capturePayment(
      input: CapturePaymentInput
    ): Promise<CapturePaymentOutput> {
      // No-op because we already captured
      return {
        data: input.payment.data,
      }
    }
  
    async cancelPayment(
      input: CancelPaymentInput
    ): Promise<CancelPaymentOutput> {
      return {
        data: input.payment.data,
      }
    }
  
    async refundPayment(
      input: RefundPaymentInput
    ): Promise<RefundPaymentOutput> {
      const { amount, payment } = input
  
      /**
       * TODO:
       * Call FluidPay refund endpoint
       */
  
      return {
        data: {
          refunded_amount: amount,
          transaction_id: payment.data?.transaction_id,
        },
      }
    }
  
    async updatePayment(
      input: UpdatePaymentInput
    ): Promise<UpdatePaymentOutput> {
      return {
        data: {
          ...input.payment.data,
          ...input.data,
        },
      }
    }
  
    async getWebhookActionAndData(
      _input: GetWebhookActionAndDataInput
    ): Promise<WebhookActionResult | null> {
      // Not using webhooks yet
      return null
    }
  }