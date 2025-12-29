/* eslint-disable @typescript-eslint/no-explicit-any */

import {
    AbstractPaymentProvider,
    PaymentSessionStatus,
  } from "@medusajs/framework/utils"
  
  type FluidPayOptions = {
    baseUrl: string
    secretKey: string
  }
  
  export default class FluidPayPaymentProviderService extends AbstractPaymentProvider {
    static identifier = "fluidpay"
  
    protected options_: FluidPayOptions
  
    constructor(container: any, options: FluidPayOptions) {
      super(container, options)
      this.options_ = options
    }
  
    /**
     * Medusa calls this when creating a payment session.
     * We can create a "pending" payment intent/transaction here OR just return session data.
     *
     * Since you want capture immediately when user places the order,
     * we can either:
     *  - create nothing here, and do the sale in authorizePayment, OR
     *  - create a sale here if token already exists.
     *
     * Most robust: do the sale in authorizePayment (token must exist by then).
     */
    async initiatePayment(context: any): Promise<any> {
      return {
        session_data: {
          // Persist anything you want here; Medusa stores it on the session.
          // We'll look up token later during authorizePayment.
          initiated_at: new Date().toISOString(),
        },
      }
    }
  
    /**
     * This is called when checkout proceeds / order placement flow authorizes payment.
     * We'll do "authorize + capture" (sale) here.
     */
    async authorizePayment(paymentSessionData: any, context: any): Promise<any> {
      const { baseUrl, secretKey } = this.options_
  
      // 1) Get token from the cart metadata or from session_data
      // You said you're writing token into cart metadata.
      const cart = context?.resource
      const tokenFromCart = cart?.metadata?.fluidpay_token
      const tokenFromSession = paymentSessionData?.fluidpay_token
  
      const token = tokenFromCart || tokenFromSession
      if (!token) {
        return {
          status: PaymentSessionStatus.ERROR,
          data: {
            ...paymentSessionData,
            error: "Missing FluidPay token (fluidpay_token).",
          },
        }
      }
  
      // 2) Amount/currency
      // Medusa totals are typically in minor units already (e.g., cents).
      // Confirm your store is using minor units consistently.
      const amount = context?.amount
      const currency_code = context?.currency_code
  
      if (!amount || !currency_code) {
        return {
          status: PaymentSessionStatus.ERROR,
          data: {
            ...paymentSessionData,
            error: "Missing amount/currency in payment context.",
          },
        }
      }
  
      // 3) Create sale / capture immediately in FluidPay
      // NOTE: Replace endpoint + payload with FluidPay's real API.
      const res = await fetch(`${baseUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
          token, // tokenized card token from iframe
          amount, // likely minor units
          currency: currency_code.toUpperCase(),
          capture: true, // explicitly capture now
          reference: cart?.id || context?.id,
        }),
      })
  
      const json = await res.json().catch(() => ({}))
  
      if (!res.ok) {
        return {
          status: PaymentSessionStatus.ERROR,
          data: {
            ...paymentSessionData,
            fluidpay_error: json,
            error:
              json?.message ||
              `FluidPay charge failed with status ${res.status}.`,
          },
        }
      }
  
      // 4) Store transaction identifiers in session data
      return {
        status: PaymentSessionStatus.AUTHORIZED,
        data: {
          ...paymentSessionData,
          fluidpay: {
            id: json?.id || json?.transaction_id,
            raw: json,
          },
        },
      }
    }
  
    /**
     * If you already captured in authorizePayment, capturePayment can be a no-op.
     */
    async capturePayment(paymentSessionData: any): Promise<any> {
      return paymentSessionData
    }
  
    async cancelPayment(paymentSessionData: any): Promise<any> {
      // Optionally call FluidPay void endpoint if supported.
      return paymentSessionData
    }
  
    async refundPayment(paymentSessionData: any, refundAmount: number): Promise<any> {
      // Optionally call FluidPay refund endpoint.
      return paymentSessionData
    }
  
    async retrievePayment(paymentSessionData: any): Promise<any> {
      return paymentSessionData
    }
  
    async updatePayment(paymentSessionData: any, data: any): Promise<any> {
      return {
        ...paymentSessionData,
        ...data,
      }
    }
  
    async deletePayment(paymentSessionData: any): Promise<any> {
      return {}
    }
  
    async getPaymentStatus(paymentSessionData: any): Promise<any> {
      // If you store a transaction id, you can map to Medusa statuses.
      return PaymentSessionStatus.AUTHORIZED
    }
  }