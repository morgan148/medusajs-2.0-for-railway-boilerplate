import AbstractPaymentProvider from "@medusajs/payment"

import {
  PaymentProviderAuthorizePaymentInput,
  PaymentProviderAuthorizePaymentOutput,
  PaymentProviderCapturePaymentInput,
  PaymentProviderCapturePaymentOutput,
  PaymentProviderRefundPaymentInput,
  PaymentProviderRefundPaymentOutput,
  PaymentProviderCancelPaymentInput,
  PaymentProviderCancelPaymentOutput,
  PaymentProviderUpdatePaymentInput,
  PaymentProviderUpdatePaymentOutput,
} from "@medusajs/types"

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
   * AUTHORIZE + CAPTURE IMMEDIATELY
   */
  async authorizePayment(
    input: PaymentProviderAuthorizePaymentInput
  ): Promise<PaymentProviderAuthorizePaymentOutput> {

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

    // TEMP simulated transaction
    const transactionId = `fp_${Date.now()}`

    return {
      status: "captured", // 👈 immediate charge
      data: {
        transaction_id: transactionId,
        amount,
        currency,
      },
    }
  }

  /**
   * No-op (already captured)
   */
  async capturePayment(
    _input: PaymentProviderCapturePaymentInput
  ): Promise<PaymentProviderCapturePaymentOutput> {
    return {
      data: {},
    }
  }

  async cancelPayment(
    input: PaymentProviderCancelPaymentInput
  ): Promise<PaymentProviderCancelPaymentOutput> {
    return {
      data: input.payment.data,
    }
  }

  async refundPayment(
    input: PaymentProviderRefundPaymentInput
  ): Promise<PaymentProviderRefundPaymentOutput> {

    const { payment, amount } = input

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
    input: PaymentProviderUpdatePaymentInput
  ): Promise<PaymentProviderUpdatePaymentOutput> {
    return {
      data: {
        ...input.payment.data,
        ...input.data,
      },
    }
  }
}