import AbstractPaymentProvider from "@medusajs/payment"

type FluidPayOptions = {
  baseUrl?: string
  secretKey: string
}

export default class FluidPayPaymentProviderService
  extends AbstractPaymentProvider {

  static identifier = "fluidpay"

  protected options_: FluidPayOptions

  constructor(container, options: FluidPayOptions) {
    super(container, options)
    this.options_ = options
  }

  /**
   * AUTHORIZE + CAPTURE IMMEDIATELY
   */
  async authorizePayment(input: any): Promise<any> {
    const session = input.paymentSession

    const amount = session.amount
    const currency = session.currency_code
    const token = session.data?.token

    if (!token) {
      throw new Error("FluidPay token missing from payment session")
    }

    /**
     * TODO:
     * Call FluidPay Tokenizer Customer Payment API
     * https://sandbox.fluidpay.com/docs/workflows/tokenizer-customer-payment
     */

    // TEMP simulated success
    const transactionId = `fp_${Date.now()}`

    return {
      status: "captured", // authorize + capture immediately
      data: {
        transaction_id: transactionId,
        amount,
        currency,
      },
    }
  }

  async capturePayment(_input: any): Promise<any> {
    // no-op (already captured)
    return { data: {} }
  }

  async cancelPayment(input: any): Promise<any> {
    return {
      data: input.payment?.data,
    }
  }

  async refundPayment(input: any): Promise<any> {
    const { payment, amount } = input

    return {
      data: {
        refunded_amount: amount,
        transaction_id: payment?.data?.transaction_id,
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