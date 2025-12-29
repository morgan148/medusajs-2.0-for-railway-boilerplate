"use client"

import { Button } from "@medusajs/ui"
import { OnApproveActions, OnApproveData } from "@paypal/paypal-js"
import { PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import React, { useState, useEffect } from "react"
import ErrorMessage from "../error-message"
import Spinner from "@modules/common/icons/spinner"
import { placeOrder, initiatePaymentSession } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { isManual, isPaypal, isStripe } from "@lib/constants"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
  onPaymentTrigger?: () => void
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
  onPaymentTrigger
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  switch (true) {
    case paymentSession?.provider_id === "pp_fluidpay_fluidpay":
      return (
        <FluidPayPaymentButton 
          cart={cart}
          notReady={notReady} 
          data-testid={dataTestId} 
        />
      )
    case isStripe(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton notReady={notReady} data-testid={dataTestId} />
      )
    case isPaypal(paymentSession?.provider_id):
      return (
        <PayPalPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    default:
      return <Button disabled>Select a payment method</Button>
  }
}

const FluidPayPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    // Listen for the token from the Loader
    const handleTokenReceived = async (event: any) => {
      const token = event.detail
      try {
        console.log("[PaymentButton] Received token, completing order...")
        // Update session with token before placing order
        await initiatePaymentSession(cart, {
          provider_id: "pp_fluidpay_fluidpay",
          data: { token }
        })
        await placeOrder()
      } catch (err: any) {
        setErrorMessage(err.message)
        setSubmitting(false)
      }
    }

    window.addEventListener("fluidpay_token_received", handleTokenReceived)
    return () => window.removeEventListener("fluidpay_token_received", handleTokenReceived)
  }, [cart])

  const handlePayment = () => {
    setSubmitting(true)
    // Dispatch event to FluidPayTokenizerLoader to start tokenization
    window.dispatchEvent(new Event("triggerFluidPayTokenize"))
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid={dataTestId}
      >
        Place order
      </Button>
      <ErrorMessage error={errorMessage} data-testid="fluidpay-error" />
    </>
  )
}

// ... (Rest of the original Stripe, Paypal, Manual buttons remain exactly the same as provided)

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = () => {
    setSubmitting(true)
    onPaymentCompleted()
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid="submit-order-button"
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

export default PaymentButton