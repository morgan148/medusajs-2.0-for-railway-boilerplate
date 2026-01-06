"use client"

import React, { useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { PencilSquare as Edit, Trash } from "@medusajs/icons"
import { Heading, Text, clx } from "@medusajs/ui"
import { useFormState } from "react-dom"
import useToggleState from "@lib/hooks/use-toggle-state"
import Modal from "@modules/common/components/modal"
import CountrySelect from "@modules/checkout/components/country-select"
import Input from "@modules/common/components/input"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import { updateCustomerAddress, deleteCustomerAddress } from "@lib/data/customer"
import Spinner from "@modules/common/icons/spinner"

type ShippingAddressesListProps = {
  customer: HttpTypes.StoreCustomer
  region: HttpTypes.StoreRegion
}

const ShippingAddressesList: React.FC<ShippingAddressesListProps> = ({
  customer,
  region,
}) => {
  // Get all addresses, sorted with defaults first
  const allAddresses = useMemo(() => {
    if (!customer.addresses || customer.addresses.length === 0) {
      return []
    }
    
    const defaultBilling = customer.addresses.find(
      (addr) => addr.is_default_billing
    )
    const defaultShipping = customer.addresses.find(
      (addr) => addr.is_default_shipping
    )
    
    // Sort: default addresses first, then others
    const sorted = [...customer.addresses].sort((a, b) => {
      const aIsDefault = a.is_default_billing || a.is_default_shipping
      const bIsDefault = b.is_default_billing || b.is_default_shipping
      if (aIsDefault && !bIsDefault) return -1
      if (!aIsDefault && bIsDefault) return 1
      return 0
    })
    
    return sorted
  }, [customer.addresses])

  if (!allAddresses.length) {
    return null
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <Heading level="h2" className="text-xl-semi">
          All Addresses
        </Heading>
        <Text className="text-base-regular text-ui-fg-subtle mt-2">
          Manage all your saved addresses
        </Text>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {allAddresses.map((address) => (
          <AddressCard key={address.id} address={address} region={region} />
        ))}
      </div>
    </div>
  )
}

type AddressCardProps = {
  address: HttpTypes.StoreCustomerAddress
  region: HttpTypes.StoreRegion
}

const AddressCard: React.FC<AddressCardProps> = ({ address, region }) => {
  const [removing, setRemoving] = React.useState(false)
  const router = useRouter()
  const { state: isOpen, open, close } = useToggleState(false)

  const [formState, formAction] = useFormState(updateCustomerAddress, {
    success: false,
    error: null,
    addressId: address.id,
  })

  useEffect(() => {
    if (formState.success) {
      close()
      router.refresh()
    }
  }, [formState.success, close, router])

  const removeAddress = async () => {
    setRemoving(true)
    await deleteCustomerAddress(address.id)
    setRemoving(false)
    router.refresh()
  }

  return (
    <>
      <div
        className={clx(
          "border rounded-rounded p-5 min-h-[220px] h-full w-full flex flex-col justify-between transition-colors",
          {
            "border-gray-900": address.is_default_shipping,
          }
        )}
        data-testid="address-container"
      >
        <div className="flex flex-col">
          <div className="flex flex-col gap-2 mb-2">
            <div className="flex items-center gap-x-2">
              <Heading
                className="text-left text-base-semi"
                data-testid="address-name"
              >
                {address.first_name} {address.last_name}
              </Heading>
            </div>
            <div className="flex items-center gap-x-2 flex-wrap">
              {address.is_default_billing && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                  Default Billing
                </span>
              )}
              {address.is_default_shipping && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                  Default Shipping
                </span>
              )}
              {!address.is_default_billing && !address.is_default_shipping && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  Additional Address
                </span>
              )}
            </div>
          </div>
          {address.company && (
            <Text
              className="txt-compact-small text-ui-fg-base"
              data-testid="address-company"
            >
              {address.company}
            </Text>
          )}
          <Text className="flex flex-col text-left text-base-regular mt-2">
            <span data-testid="address-address">
              {address.address_1}
              {address.address_2 && <span>, {address.address_2}</span>}
            </span>
            <span data-testid="address-postal-city">
              {address.postal_code}, {address.city}
            </span>
            <span data-testid="address-province-country">
              {address.province && `${address.province}, `}
              {address.country_code?.toUpperCase()}
            </span>
            {address.phone && (
              <span data-testid="address-phone">{address.phone}</span>
            )}
          </Text>
        </div>
        <div className="flex items-center gap-x-4 mt-4">
          <button
            className="text-small-regular text-ui-fg-base flex items-center gap-x-2"
            onClick={open}
            data-testid="address-edit-button"
          >
            <Edit />
            Edit
          </button>
          <button
            className="text-small-regular text-ui-fg-base flex items-center gap-x-2"
            onClick={removeAddress}
            data-testid="address-delete-button"
          >
            {removing ? <Spinner /> : <Trash />}
            Remove
          </button>
        </div>
      </div>

      <Modal isOpen={isOpen} close={close} data-testid="edit-address-modal">
        <Modal.Title>
          <Heading className="mb-2">Edit address</Heading>
        </Modal.Title>
        <form action={formAction}>
          <Modal.Body>
            <div className="flex flex-col gap-y-2">
              <div className="grid grid-cols-2 gap-x-2">
                <Input
                  label="First name"
                  name="first_name"
                  required
                  autoComplete="given-name"
                  defaultValue={address.first_name || undefined}
                  data-testid="first-name-input"
                />
                <Input
                  label="Last name"
                  name="last_name"
                  required
                  autoComplete="family-name"
                  defaultValue={address.last_name || undefined}
                  data-testid="last-name-input"
                />
              </div>
              <Input
                label="Company"
                name="company"
                autoComplete="organization"
                defaultValue={address.company || undefined}
                data-testid="company-input"
              />
              <Input
                label="Address"
                name="address_1"
                required
                autoComplete="address-line1"
                defaultValue={address.address_1 || undefined}
                data-testid="address-1-input"
              />
              <Input
                label="Apartment, suite, etc."
                name="address_2"
                autoComplete="address-line2"
                defaultValue={address.address_2 || undefined}
                data-testid="address-2-input"
              />
              <div className="grid grid-cols-[144px_1fr] gap-x-2">
                <Input
                  label="Postal code"
                  name="postal_code"
                  required
                  autoComplete="postal-code"
                  defaultValue={address.postal_code || undefined}
                  data-testid="postal-code-input"
                />
                <Input
                  label="City"
                  name="city"
                  required
                  autoComplete="locality"
                  defaultValue={address.city || undefined}
                  data-testid="city-input"
                />
              </div>
              <Input
                label="Province / State"
                name="province"
                autoComplete="address-level1"
                defaultValue={address.province || undefined}
                data-testid="state-input"
              />
              <CountrySelect
                region={region}
                name="country_code"
                required
                autoComplete="country"
                defaultValue={address.country_code || undefined}
                data-testid="country-select"
              />
              <Input
                label="Phone"
                name="phone"
                autoComplete="phone"
                defaultValue={address.phone || undefined}
                data-testid="phone-input"
              />
            </div>
            {formState.error && (
              <div className="text-rose-500 text-small-regular py-2">
                {formState.error}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <div className="flex gap-3 mt-6">
              <button
                type="reset"
                onClick={close}
                className="h-10 px-4 border border-ui-border-base rounded-rounded hover:bg-ui-bg-subtle-hover"
                data-testid="cancel-button"
              >
                Cancel
              </button>
              <SubmitButton data-testid="save-button">Save</SubmitButton>
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  )
}

export default ShippingAddressesList

