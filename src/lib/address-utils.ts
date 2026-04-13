export interface AddressableEntity {
  customerAddress: string
  addressLine1?: string | null
  addressLine2?: string | null
  addressLine3?: string | null
  pinCode?: string | null
  city?: string | null
  state?: string | null
}

export const formatStructuredAddress = (entity: AddressableEntity): string => {
  if (!entity.addressLine1) {
    return entity.customerAddress
  }

  const cityPinParts = [entity.city, entity.pinCode].filter(Boolean)
  const cityPin = cityPinParts.length > 0 ? cityPinParts.join(' - ') : null

  return [
    entity.addressLine1,
    entity.addressLine2,
    entity.addressLine3,
    cityPin,
    entity.state,
  ]
    .filter(Boolean)
    .join('\n')
}
