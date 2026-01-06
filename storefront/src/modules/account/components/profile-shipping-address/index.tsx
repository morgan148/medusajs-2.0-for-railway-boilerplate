"use client"

import React, { useEffect, useMemo } from "react"

import Input from "@modules/common/components/input"
import NativeSelect from "@modules/common/components/native-select"

import AccountInfo from "../account-info"
import { useFormState } from "react-dom"
import { HttpTypes } from "@medusajs/types"
import { updateCustomerAddress, addCustomerAddress } from "@lib/data/customer"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
  regions: HttpTypes.StoreRegion[]
}

const ProfileShippingAddress: React.FC<MyInformationProps> = ({
  customer,
  regions,
}) => {
  const regionOptions = useMemo(() => {
    return (
      regions
        ?.map((region) => {
          return region.countries?.map((country) => ({
            value: country.iso_2,
            label: country.display_name,
          }))
        })
        .flat() || []
    )
  }, [regions])

  const [successState, setSuccessState] = React.useState(false)

  const shippingAddress = customer.addresses?.find(
    (addr) => addr.is_default_shipping
  )

  // Create a wrapper function that handles both create and update
  const handleAddressAction = async (
    currentState: Record<string, unknown>,
    formData: FormData
  ) => {
    if (shippingAddress) {
      return updateCustomerAddress(currentState, formData)
    } else {
      return addCustomerAddress(currentState, formData)
    }
  }

  const [state, formAction] = useFormState(handleAddressAction, {
    error: false,
    success: false,
    addressId: shippingAddress?.id || undefined,
  })

  const clearState = () => {
    setSuccessState(false)
  }

  useEffect(() => {
    setSuccessState(state.success)
  }, [state])

  const currentInfo = useMemo(() => {
    if (!shippingAddress) {
      return "No shipping address"
    }

    const country =
      regionOptions?.find(
        (country) => country?.value === shippingAddress.country_code
      )?.label || shippingAddress.country_code?.toUpperCase()

    return (
      <div className="flex flex-col font-semibold" data-testid="current-info">
        <span>
          {shippingAddress.first_name} {shippingAddress.last_name}
        </span>
        <span>{shippingAddress.company}</span>
        <span>
          {shippingAddress.address_1}
          {shippingAddress.address_2 ? `, ${shippingAddress.address_2}` : ""}
        </span>
        <span>
          {shippingAddress.postal_code}, {shippingAddress.city}
        </span>
        <span>{country}</span>
      </div>
    )
  }, [shippingAddress, regionOptions])

  return (
    <form action={formAction} onReset={() => clearState()} className="w-full">
      <AccountInfo
        label="Shipping address"
        currentInfo={currentInfo}
        isSuccess={successState}
        isError={!!state.error}
        clearState={clearState}
        data-testid="account-shipping-address-editor"
      >
        <div className="grid grid-cols-1 gap-y-2">
          <div className="grid grid-cols-2 gap-x-2">
            <Input
              label="First name"
              name="shipping_address.first_name"
              defaultValue={shippingAddress?.first_name || undefined}
              required
              data-testid="shipping-first-name-input"
            />
            <Input
              label="Last name"
              name="shipping_address.last_name"
              defaultValue={shippingAddress?.last_name || undefined}
              required
              data-testid="shipping-last-name-input"
            />
          </div>
          <Input
            label="Company"
            name="shipping_address.company"
            defaultValue={shippingAddress?.company || undefined}
            data-testid="shipping-company-input"
          />
          <Input
            label="Address"
            name="shipping_address.address_1"
            defaultValue={shippingAddress?.address_1 || undefined}
            required
            data-testid="shipping-address-1-input"
          />
          <Input
            label="Apartment, suite, etc."
            name="shipping_address.address_2"
            defaultValue={shippingAddress?.address_2 || undefined}
            data-testid="shipping-address-2-input"
          />
          <div className="grid grid-cols-[144px_1fr] gap-x-2">
            <Input
              label="Postal code"
              name="shipping_address.postal_code"
              defaultValue={shippingAddress?.postal_code || undefined}
              required
              data-testid="shipping-postal-code-input"
            />
            <Input
              label="City"
              name="shipping_address.city"
              defaultValue={shippingAddress?.city || undefined}
              required
              data-testid="shipping-city-input"
            />
          </div>
          <Input
            label="Province"
            name="shipping_address.province"
            defaultValue={shippingAddress?.province || undefined}
            data-testid="shipping-province-input"
          />
          <NativeSelect
            name="shipping_address.country_code"
            defaultValue={shippingAddress?.country_code || undefined}
            required
            data-testid="shipping-country-code-select"
          >
            <option value="">-</option>
            {regionOptions.map((option, i) => {
              return (
                <option key={i} value={option?.value}>
                  {option?.label}
                </option>
              )
            })}
          </NativeSelect>
          <Input
            label="Phone"
            name="shipping_address.phone"
            defaultValue={shippingAddress?.phone || undefined}
            data-testid="shipping-phone-input"
          />
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfileShippingAddress

