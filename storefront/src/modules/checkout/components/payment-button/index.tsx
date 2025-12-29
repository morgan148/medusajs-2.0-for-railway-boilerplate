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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
    const handleTokenReceived = async (event: any) => {
      const token = event.detail
      try {
        console.log("[PaymentButton] Received token, broadcasting to backend...", token)
        
        // ✅ TRIPLE-PATH DATA PROPAGATION
        await initiatePaymentSession(cart, {
          provider_id: "pp_fluidpay_fluidpay",
          data: { 
            token: token,
            fluidpay_token: token,
            data: { token: token } // Backup nested path
          }
        })

        // Increase wait time to ensure Railway DB consistency
        await sleep(2000)

        console.log("[PaymentButton] Finalizing Place Order...")
        await placeOrder()
      } catch (err: any) {
        console.error("[PaymentButton] Error:", err)
        setErrorMessage(err.message || "The payment session could not be authorized.")
        setSubmitting(false)
      }
    }

    window.addEventListener("fluidpay_token_received", handleTokenReceived)
    return () => window.removeEventListener("fluidpay_token_received", handleTokenReceived)
  }, [cart])

  const handlePayment = () => {
    setSubmitting(true)
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

// ... rest of the file (Stripe, PayPal, etc.) remains exactly the same as your current version

const StripePaymentButton = ({
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
  const stripe = useStripe()
  const elements = useElements()
  const card = elements?.getElement("card")
  const session = cart.payment_collection?.payment_sessions?.find((s) => s.status === "pending")
  const disabled = !stripe || !elements ? true : false
  const handlePayment = async () => {
    setSubmitting(true)
    if (!stripe || !elements || !card || !cart) { setSubmitting(false); return; }
    await stripe.confirmCardPayment(session?.data.client_secret as string, {
        payment_method: {
          card: card,
          billing_details: {
            name: cart.billing_address?.first_name + " " + cart.billing_address?.last_name,
            address: {
              city: cart.billing_address?.city ?? undefined,
              country: cart.billing_address?.country_code ?? undefined,
              line1: cart.billing_address?.address_1 ?? undefined,
              line2: cart.billing_address?.address_2 ?? undefined,
              postal_code: cart.billing_address?.postal_code ?? undefined,
              state: cart.billing_address?.province ?? undefined,
            },
            email: cart.email,
            phone: cart.billing_address?.phone ?? undefined,
          },
        },
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent
          if ((pi && pi.status === "requires_capture") || (pi && pi.status === "succeeded")) { placeOrder().catch((err) => setErrorMessage(err.message)).finally(() => setSubmitting(false)); }
          setErrorMessage(error.message || null); return;
        }
        if ((paymentIntent && paymentIntent.status === "requires_capture") || paymentIntent.status === "succeeded") {
           placeOrder().catch((err) => setErrorMessage(err.message)).finally(() => setSubmitting(false));
        }
      })
  }
  return ( <> <Button disabled={disabled || notReady} onClick={handlePayment} size="large" isLoading={submitting} data-testid={dataTestId}> Place order </Button> <ErrorMessage error={errorMessage} data-testid="stripe-payment-error-message" /> </> )
}

const PayPalPaymentButton = ({
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
  const session = cart.payment_collection?.payment_sessions?.find((s) => s.status === "pending")
  const handlePayment = async (_data: OnApproveData, actions: OnApproveActions) => {
    actions?.order?.authorize().then((authorization) => {
        if (authorization.status !== "COMPLETED") { setErrorMessage(`An error occurred, status: ${authorization.status}`); return; }
        placeOrder().catch((err) => setErrorMessage(err.message)).finally(() => setSubmitting(false));
      }).catch(() => { setErrorMessage(`An unknown error occurred, please try again.`); setSubmitting(false); })
  }
  const [{ isPending, isResolved }] = usePayPalScriptReducer()
  if (isPending) return <Spinner />
  if (isResolved) {
    return ( <> <PayPalButtons style={{ layout: "horizontal" }} createOrder={async () => session?.data.id as string} onApprove={handlePayment} disabled={notReady || submitting || isPending} data-testid={dataTestId} /> <ErrorMessage error={errorMessage} data-testid="paypal-payment-error-message" /> </> )
  }
}

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const handlePayment = () => {
    setSubmitting(true)
    placeOrder().catch((err) => setErrorMessage(err.message)).finally(() => setSubmitting(false));
  }
  return ( <> <Button disabled={notReady} isLoading={submitting} onClick={handlePayment} size="large" data-testid="submit-order-button"> Place order </Button> <ErrorMessage error={errorMessage} data-testid="manual-payment-error-message" /> </> )
}

export default PaymentButton