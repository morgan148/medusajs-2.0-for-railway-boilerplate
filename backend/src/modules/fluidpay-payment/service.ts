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
     * Called when Medusa creates a payment session.
     * We do NOT charge here — just acknowledge the session.
     */
    async initiatePayment(context: any): Promise<any> {
      return {
        session_data: {
          created_at: new Date().toISOString(),
        },
      }
    }
  
    /**
     * Called when the order is placed.
     * We charge the card here (authorize + capture immediately).
     */
    async authorizePayment(paymentSessionData: any, context: any): Promise<any> {
      const { baseUrl, secretKey } = this.options_
  
      const cart = context?.resource
  
      /**
       * This MUST be written to cart.metadata by your tokenizer callback
       * Example:
       * cart.metadata.fluidpay_payment_method_id = "pm_xxx"
       */
      const paymentMethodId =
        cart?.metadata?.fluidpay_payment_method_id ??
        paymentSessionData?.fluidpay_payment_method_id
  
      if (!paymentMethodId) {
        return {
          status: PaymentSessionStatus.ERROR,
          data: {
            ...paymentSessionData,
            error: "Missing FluidPay payment_method_id",
          },
        }
      }
  
      const amount = context?.amount
      const currency = context?.currency_code?.toUpperCase()
  
      if (!amount || !currency) {
        return {
          status: PaymentSessionStatus.ERROR,
          data: {
            ...paymentSessionData,
            error: "Missing amount or currency",
          },
        }
      }
  
      // FluidPay: Create customer payment (this captures immediately)
      const res = await fetch(`${baseUrl}/customer-payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
          payment_method_id: paymentMethodId,
          amount,
          currency,
          description: `Order ${cart?.id}`,
        }),
      })
  
      const json = await res.json().catch(() => ({}))
  
      if (!res.ok) {
        return {
          status: PaymentSessionStatus.ERROR,
          data: {
            ...paymentSessionData,
            fluidpay_error: json,
            error: json?.message || "FluidPay charge failed",
          },
        }
      }
  
      return {
        status: PaymentSessionStatus.AUTHORIZED,
        data: {
          ...paymentSessionData,
          fluidpay: {
            id: json.id,
            status: json.status,
            raw: json,
          },
        },
      }
    }
  
    /**
     * No-op because capture already happened.
     */
    async capturePayment(paymentSessionData: any): Promise<any> {
      return paymentSessionData
    }
  
    async cancelPayment(paymentSessionData: any): Promise<any> {
      return paymentSessionData
    }
  
    async refundPayment(paymentSessionData: any, refundAmount: number): Promise<any> {
      // Optional: implement /refunds endpoint if needed
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
      return PaymentSessionStatus.AUTHORIZED
    }
  }