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

  const lines: string[] = [entity.addressLine1]

  if (entity.addressLine2) {
    lines.push(entity.addressLine2)
  }

  if (entity.addressLine3) {
    lines.push(entity.addressLine3)
  }

  if (entity.city && entity.pinCode) {
    lines.push(`${entity.city} - ${entity.pinCode}`)
  } else if (entity.city) {
    lines.push(entity.city)
  } else if (entity.pinCode) {
    lines.push(entity.pinCode)
  }

  if (entity.state) {
    lines.push(entity.state)
  }

  return lines.join('\n')
}
