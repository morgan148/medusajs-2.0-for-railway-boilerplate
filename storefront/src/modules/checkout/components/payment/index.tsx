"use client"

import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { RadioGroup } from "@headlessui/react"
import ErrorMessage from "@modules/checkout/components/error-message"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import { Button, Container, Heading, Text, clx } from "@medusajs/ui"
import { CardElement } from "@stripe/react-stripe-js"
import { StripeCardElementOptions } from "@stripe/stripe-js"
import FluidPayTokenizerLoader from "@modules/checkout/components/fluidpay-tokenizer-loader"
import Divider from "@modules/common/components/divider"
import PaymentContainer from "@modules/checkout/components/payment-container"
import { isStripe as isStripeFunc, paymentInfoMap } from "@lib/constants"
import { StripeContext } from "@modules/checkout/components/payment-wrapper"
import { initiatePaymentSession } from "@lib/data/cart"

const FP_PROVIDER_ID = "pp_fluidpay_fluidpay"
const SHOW_PAYMENT_METHOD_CHOOSER = false

const Payment = ({ cart, availablePaymentMethods }: { cart: any, availablePaymentMethods: any[] }) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession: any) => paymentSession.status === "pending"
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(activeSession?.provider_id ?? "")

  // ✅ FIXED: Using direct process.env to ensure it's not undefined
  const fpBaseUrl = process.env.NEXT_PUBLIC_FLUIDPAY_BASE_URL || "https://sandbox.fluidpay.com"

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const isOpen = searchParams.get("step") === "payment"
  const isFluidPay = selectedPaymentMethod === FP_PROVIDER_ID

  useEffect(() => {
    if (!isOpen || selectedPaymentMethod === FP_PROVIDER_ID) return
    if (!selectedPaymentMethod || selectedPaymentMethod === "pp_system_default") {
      setSelectedPaymentMethod(FP_PROVIDER_ID)
    }
  }, [isOpen, selectedPaymentMethod])

  const createQueryString = useCallback((name: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    params.set(name, value)
    return params.toString()
  }, [searchParams])

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      if (!activeSession || activeSession.provider_id !== selectedPaymentMethod) {
        await initiatePaymentSession(cart, { provider_id: selectedPaymentMethod })
        router.refresh()
      }
      // Move to Review step - Tokenization happens there!
      return router.push(pathname + "?" + createQueryString("step", "review"), { scroll: false })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading level="h2" className={clx("flex flex-row text-3xl-regular gap-x-2 items-baseline", { "opacity-50": !isOpen })}>
          Payment {!isOpen && activeSession && <CheckCircleSolid />}
        </Heading>
      </div>

      <div className={isOpen ? "block" : "hidden"}>
        {isFluidPay && (
          <div className="mt-4 p-4 border rounded-md bg-ui-bg-subtle">
            <Text className="mb-4 txt-medium-plus text-ui-fg-base">Credit Card Details</Text>
            {/* ✅ FIXED: Passing validated URL */}
            <FluidPayTokenizerLoader
              srcBaseUrl={fpBaseUrl}
              publicKey={process.env.NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY || ""}
              cartId={cart?.id || ""}
            />
          </div>
        )}

        <ErrorMessage error={error} />

        <Button
          size="large"
          className="mt-6"
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={!selectedPaymentMethod}
        >
          Continue to review
        </Button>
      </div>

      {/* Summary View */}
      <div className={isOpen ? "hidden" : "block"}>
        {activeSession && (
          <div className="flex items-start gap-x-1 w-full">
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus mb-1">Payment method</Text>
              <Text className="txt-medium text-ui-fg-subtle">{paymentInfoMap[selectedPaymentMethod]?.title || "FluidPay"}</Text>
            </div>
          </div>
        )}
      </div>
      <Divider className="mt-8" />
    </div>
  )
}

export default Payment