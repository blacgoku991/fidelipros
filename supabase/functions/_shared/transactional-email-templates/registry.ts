/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as managerInvitation } from './manager-invitation.tsx'
import { template as merchantWelcome } from './merchant-welcome.tsx'
import { template as paymentSucceeded } from './payment-succeeded.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'manager-invitation': managerInvitation,
  'merchant-welcome': merchantWelcome,
  'payment-succeeded': paymentSucceeded,
}