import type { IPaymentProvider } from "@medusajs/framework/types"

type FluidPayOptions = {
  baseUrl?: string
  secretKey: string
}

const FluidPayProvider: IPaymentProvider<FluidPayOptions> = {
  identifier: "fluidpay",

  async authorizePayment({ paymentSession }) {
    const token = (paymentSession?.data as any)?.token

    if (!token) {
      throw new Error("FluidPay token missing from payment session")
    }

    // TODO: Call FluidPay Tokenizer Customer Payment API here
    // https://sandbox.fluidpay.com/docs/workflows/tokenizer-customer-payment

    const transactionId = `fp_${Date.now()}`

    return {
      status: "captured",
      data: {
        transaction_id: transactionId,
        amount: paymentSession.amount,
        currency_code: paymentSession.currency_code,
      },
    }
  },

  async capturePayment() {
    return { data: {} }
  },

  async cancelPayment({ payment }) {
    return { data: payment.data }
  },

  async refundPayment({ amount, payment }) {
    return {
      data: {
        refunded_amount: amount,
        transaction_id: payment.data?.transaction_id,
      },
    }
  },

  async updatePayment({ payment, data }) {
    return {
      data: {
        ...payment.data,
        ...data,
      },
    }
  },
}

export default FluidPayProvider