"use client"

import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { RadioGroup } from "@headlessui/react"
import ErrorMessage from "@modules/checkout/components/error-message"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import { Button, Container, Heading, Text, Tooltip, clx } from "@medusajs/ui"
import { CardElement } from "@stripe/react-stripe-js"
import { StripeCardElementOptions } from "@stripe/stripe-js"
import FluidPayTokenizerLoader from "@modules/checkout/components/fluidpay-tokenizer-loader"

import Divider from "@modules/common/components/divider"
import PaymentContainer from "@modules/checkout/components/payment-container"
import { isStripe as isStripeFunc, paymentInfoMap } from "@lib/constants"
import { StripeContext } from "@modules/checkout/components/payment-wrapper"
import { initiatePaymentSession } from "@lib/data/cart"

const FP_PROVIDER_ID = "pp_fluidpay_fluidpay"

// Set to true if you want to show the payment method chooser.
// For your “skip selection” goal, keep this false.
const SHOW_PAYMENT_METHOD_CHOOSER = false

const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: any
  availablePaymentMethods: any[]
}) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession: any) => paymentSession.status === "pending"
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardBrand, setCardBrand] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ""
  )

  // FluidPay
  const fpBaseUrl = process.env.NEXT_PUBLIC_FLUIDPAY_BASE_URL || ""

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "payment"

  const isStripe = isStripeFunc(activeSession?.provider_id)
  const stripeReady = useContext(StripeContext)

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  const paymentReady =
    (activeSession && cart?.shipping_methods.length !== 0) || paidByGiftcard

  const isFluidPay = selectedPaymentMethod === FP_PROVIDER_ID

  /**
   * =========================
   * DEBUG LOGGING (STEP 1)
   * =========================
   */

  // Log the available payment methods whenever they change
  useEffect(() => {
    if (!availablePaymentMethods?.length) {
      console.log("[Payment] availablePaymentMethods: (empty/undefined)", {
        availablePaymentMethods,
      })
      return
    }

    console.log("[Payment] availablePaymentMethods:", availablePaymentMethods)

    // Helpful condensed view
    console.log(
      "[Payment] availablePaymentMethods (ids/provider_id):",
      availablePaymentMethods.map((m: any) => ({
        id: m?.id,
        provider_id: m?.provider_id,
      }))
    )

    const hasFluidPay = availablePaymentMethods.some(
      (m: any) => m?.id === FP_PROVIDER_ID
    )
    console.log("[Payment] hasFluidPay:", hasFluidPay, "FP_PROVIDER_ID:", FP_PROVIDER_ID)
  }, [availablePaymentMethods])

  // Log key state snapshots when step/session/method changes
  useEffect(() => {
    console.log("[Payment] state snapshot:", {
      step: searchParams.get("step"),
      isOpen,
      paidByGiftcard,
      paymentReady,
      cartId: cart?.id,
      selectedPaymentMethod,
      activeSessionProviderId: activeSession?.provider_id,
      activeSessionStatus: activeSession?.status,
      isStripeSelected: isStripeFunc(selectedPaymentMethod),
      isStripeActiveSession: isStripeFunc(activeSession?.provider_id),
      paymentSessions: cart?.payment_collection?.payment_sessions?.map((s: any) => ({
        provider_id: s?.provider_id,
        status: s?.status,
      })),
    })
  }, [
    isOpen,
    paidByGiftcard,
    paymentReady,
    selectedPaymentMethod,
    activeSession?.provider_id,
    activeSession?.status,
    cart?.id,
    cart?.payment_collection?.payment_sessions,
    searchParams,
  ])

  // Auto-select FluidPay when the Payment step is opened
  useEffect(() => {
    if (!isOpen) return
    if (paidByGiftcard) return

    // If it's already FluidPay, do nothing.
    if (selectedPaymentMethod === FP_PROVIDER_ID) return

    // If there is an active session already (e.g., returning to payment step),
    // we respect it unless it's empty.
    // But since you want FluidPay default, we’ll set it whenever it’s blank or manual.
    const shouldForceFluidPay =
      !selectedPaymentMethod || selectedPaymentMethod === "pp_system_default"

    if (shouldForceFluidPay) {
      console.log("[Payment] Forcing selectedPaymentMethod to FluidPay", {
        from: selectedPaymentMethod,
        to: FP_PROVIDER_ID,
      })
      setSelectedPaymentMethod(FP_PROVIDER_ID)
    }
  }, [isOpen, paidByGiftcard, selectedPaymentMethod])

  const useOptions: StripeCardElementOptions = useMemo(() => {
    return {
      style: {
        base: {
          fontFamily: "Inter, sans-serif",
          color: "#424270",
          "::placeholder": {
            color: "rgb(107 114 128)",
          },
        },
      },
      classes: {
        base: "pt-3 pb-1 block w-full h-11 px-4 mt-0 bg-ui-bg-field border rounded-md appearance-none focus:outline-none focus:ring-0 focus:shadow-borders-interactive-with-active border-ui-border-base hover:bg-ui-bg-field-hover transition-all duration-300 ease-in-out",
      },
    }
  }, [])

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)
      return params.toString()
    },
    [searchParams]
  )

  const handleEdit = () => {
    router.push(pathname + "?" + createQueryString("step", "payment"), {
      scroll: false,
    })
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const shouldInputCard =
        isStripeFunc(selectedPaymentMethod) && !activeSession

      console.log("[Payment] handleSubmit clicked", {
        cartId: cart?.id,
        selectedPaymentMethod,
        shouldInputCard,
        hasActiveSession: !!activeSession,
        activeSessionProviderId: activeSession?.provider_id,
        activeSessionStatus: activeSession?.status,
      })

      if (!activeSession) {
        console.log("[Payment] Submitting payment session", {
          cartId: cart?.id,
          provider_id: selectedPaymentMethod,
          existingPaymentSessions:
            cart?.payment_collection?.payment_sessions?.map((s: any) => ({
              provider_id: s?.provider_id,
              status: s?.status,
            })),
        })

        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod,
        })

        console.log("[Payment] initiatePaymentSession completed")
      } else {
        console.log("[Payment] Skipping initiatePaymentSession because activeSession exists")
      }

      if (!shouldInputCard) {
        console.log("[Payment] Routing to review step")
        return router.push(
          pathname + "?" + createQueryString("step", "review"),
          {
            scroll: false,
          }
        )
      }
    } catch (err: any) {
      console.error("[Payment] handleSubmit error:", err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && !paymentReady,
            }
          )}
        >
          Payment
          {!isOpen && paymentReady && <CheckCircleSolid />}
        </Heading>
        {!isOpen && paymentReady && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="edit-payment-button"
            >
              Edit
            </button>
          </Text>
        )}
      </div>

      <div>
        <div className={isOpen ? "block" : "hidden"}>
          {!paidByGiftcard && availablePaymentMethods?.length ? (
            <>
              {/* Payment method chooser (optional) */}
              {SHOW_PAYMENT_METHOD_CHOOSER && (
                <RadioGroup
                  value={selectedPaymentMethod}
                  onChange={(value: string) => setSelectedPaymentMethod(value)}
                >
                  {availablePaymentMethods
                    .sort((a, b) => {
                      return a.provider_id > b.provider_id ? 1 : -1
                    })
                    .map((paymentMethod) => {
                      return (
                        <PaymentContainer
                          paymentInfoMap={paymentInfoMap}
                          paymentProviderId={paymentMethod.id}
                          key={paymentMethod.id}
                          selectedPaymentOptionId={selectedPaymentMethod}
                        />
                      )
                    })}
                </RadioGroup>
              )}

              {/* FluidPay tokenizer (default path) */}
              {isFluidPay && (
                <FluidPayTokenizerLoader
                  srcBaseUrl={fpBaseUrl}
                  cartId={cart?.id || ""}
                  publicKey={process.env.NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY || ""}
                />
              )}

              {/* Stripe card element (only if Stripe is selected) */}
              {isStripe && stripeReady && (
                <div className="mt-5 transition-all duration-150 ease-in-out">
                  <Text className="txt-medium-plus text-ui-fg-base mb-1">
                    Enter your card details:
                  </Text>

                  <CardElement
                    options={useOptions as StripeCardElementOptions}
                    onChange={(e) => {
                      setCardBrand(
                        e.brand &&
                          e.brand.charAt(0).toUpperCase() + e.brand.slice(1)
                      )
                      setError(e.error?.message || null)
                      setCardComplete(e.complete)
                    }}
                  />
                </div>
              )}
            </>
          ) : null}

          {paidByGiftcard && (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Payment method
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Gift card
              </Text>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />

          <Button
            size="large"
            className="mt-6"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={
              (isStripe && !cardComplete) ||
              (!selectedPaymentMethod && !paidByGiftcard)
            }
            data-testid="submit-payment-button"
          >
            {!activeSession && isStripeFunc(selectedPaymentMethod)
              ? " Enter card details"
              : "Continue to review"}
          </Button>
        </div>

        <div className={isOpen ? "hidden" : "block"}>
          {cart && paymentReady && activeSession ? (
            <div className="flex items-start gap-x-1 w-full">
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Payment method
                </Text>
                <Text
                  className="txt-medium text-ui-fg-subtle"
                  data-testid="payment-method-summary"
                >
                  {paymentInfoMap[selectedPaymentMethod]?.title ||
                    selectedPaymentMethod}
                </Text>
              </div>
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Payment details
                </Text>
                <div
                  className="flex gap-2 txt-medium text-ui-fg-subtle items-center"
                  data-testid="payment-details-summary"
                >
                  <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                    {paymentInfoMap[selectedPaymentMethod]?.icon || (
                      <CreditCard />
                    )}
                  </Container>
                  <Text>
                    {isStripeFunc(selectedPaymentMethod) && cardBrand
                      ? cardBrand
                      : "Another step will appear"}
                  </Text>
                </div>
              </div>
            </div>
          ) : paidByGiftcard ? (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Payment method
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Gift card
              </Text>
            </div>
          ) : null}
        </div>
      </div>

      <Divider className="mt-8" />
    </div>
  )
}

export default Payment