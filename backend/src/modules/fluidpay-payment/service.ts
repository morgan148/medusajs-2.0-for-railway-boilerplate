import PaymentProviderService from "@medusajs/medusa/dist/services/payment-provider"

type FluidPayOptions = {
  baseUrl?: string
  secretKey: string
}

export default class FluidPayPaymentProviderService
  extends PaymentProviderService {

  static identifier = "fluidpay"

  protected options_: FluidPayOptions

  constructor(container, options: FluidPayOptions) {
    super(container)
    this.options_ = options
  }

  /**
   * AUTHORIZE + CAPTURE (IMMEDIATE)
   */
  async authorizePayment(input: any): Promise<any> {
    const session = input.paymentSession

    const amount = session.amount
    const currency = session.currency_code
    const token = session.data?.token

    if (!token) {
      throw new Error("FluidPay token missing from payment session")
    }

    // TODO: Replace with real FluidPay API call
    const transactionId = `fp_${Date.now()}`

    return {
      status: "captured",
      data: {
        transaction_id: transactionId,
        amount,
        currency,
      },
    }
  }

  async capturePayment(): Promise<any> {
    return { data: {} }
  }

  async cancelPayment(input: any): Promise<any> {
    return { data: input.payment?.data }
  }

  async refundPayment(input: any): Promise<any> {
    return {
      data: {
        refunded_amount: input.amount,
        transaction_id: input.payment?.data?.transaction_id,
      },
    }
  }

  async updatePayment(input: any): Promise<any> {
    return {
      data: {
        ...input.payment?.data,
        ...input.data,
      },
    }
  }
}