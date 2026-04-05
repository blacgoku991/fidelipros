import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface PaymentSucceededProps {
  businessName?: string
  plan?: string
  amount?: number
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  franchise: 'Franchise',
}

const PaymentSucceededEmail = ({
  businessName,
  plan,
  amount,
}: PaymentSucceededProps) => {
  const safeBusinessName = businessName || 'Votre commerce'
  const planLabel = PLAN_LABELS[plan || ''] || 'Abonnement'

  return (
    <Html lang="fr">
      <Head />
      <Preview>Paiement confirmé pour {safeBusinessName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>FidéliPro</Text>
          <Heading style={title}>Paiement confirmé</Heading>
          <Text style={text}>
            Votre abonnement est actif. Vous pouvez continuer à configurer et piloter votre programme de fidélité.
          </Text>
          <Section style={panel}>
            <Text style={row}><strong>Commerce :</strong> {safeBusinessName}</Text>
            <Text style={row}><strong>Plan :</strong> {planLabel}</Text>
            {typeof amount === 'number' ? (
              <Text style={row}><strong>Montant :</strong> {amount.toFixed(2)} €</Text>
            ) : null}
          </Section>
          <Button href="https://fidelipro.com/setup" style={button}>
            Continuer la configuration
          </Button>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PaymentSucceededEmail,
  subject: ({ plan }: Record<string, any>) =>
    `Confirmation de paiement — ${PLAN_LABELS[plan || ''] || 'Abonnement'} FidéliPro`,
  displayName: 'Paiement confirmé',
  previewData: {
    businessName: 'Maison Lina',
    plan: 'franchise',
    amount: 199,
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif",
  margin: 0,
  padding: '32px 16px',
}

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '36px 32px',
  backgroundColor: '#ffffff',
  border: '1px solid #E5E7EB',
  borderRadius: '24px',
  boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
}

const eyebrow = {
  margin: '0 0 12px',
  color: '#4F46E5',
  fontSize: '12px',
  fontWeight: '800',
  letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
}

const title = {
  margin: '0 0 16px',
  color: '#0F172A',
  fontSize: '30px',
  lineHeight: '1.1',
  fontWeight: '800',
}

const text = {
  margin: '0 0 18px',
  color: '#475569',
  fontSize: '15px',
  lineHeight: '1.7',
}

const panel = {
  margin: '0 0 24px',
  padding: '18px 20px',
  borderRadius: '18px',
  backgroundColor: '#F8FAFC',
  border: '1px solid #E2E8F0',
}

const row = {
  margin: '0 0 10px',
  color: '#334155',
  fontSize: '14px',
  lineHeight: '1.6',
}

const button = {
  backgroundColor: '#4F46E5',
  borderRadius: '999px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '700',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}