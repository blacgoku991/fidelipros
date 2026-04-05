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

interface ManagerInvitationProps {
  businessName?: string
  locationName?: string
  actionLink?: string
}

const ManagerInvitationEmail = ({
  businessName,
  locationName,
  actionLink,
}: ManagerInvitationProps) => {
  const safeBusinessName = businessName || 'FidéliPro'
  const safeLocationName = locationName || 'votre établissement'

  return (
    <Html lang="fr">
      <Head />
      <Preview>Invitation manager pour {safeLocationName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>FidéliPro</Text>
          <Heading style={title}>Vous êtes invité comme manager</Heading>
          <Text style={text}>
            Vous avez été invité à gérer <strong>{safeLocationName}</strong> pour{' '}
            <strong>{safeBusinessName}</strong>.
          </Text>
          <Section style={panel}>
            <Text style={panelLabel}>Accès accordé</Text>
            <Text style={panelValue}>{safeLocationName}</Text>
            <Text style={panelText}>
              Connectez-vous pour accéder au tableau de bord, suivre l’activité et gérer les scans.
            </Text>
          </Section>
          {actionLink ? (
            <Button href={actionLink} style={button}>
              Accepter l’invitation
            </Button>
          ) : null}
          <Text style={caption}>
            Si vous n’êtes pas à l’origine de cette invitation, vous pouvez ignorer cet email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ManagerInvitationEmail,
  subject: ({ businessName, locationName }: Record<string, any>) =>
    `Invitation manager — ${locationName || businessName || 'FidéliPro'}`,
  displayName: 'Invitation manager',
  previewData: {
    businessName: 'Maison Lina',
    locationName: 'Boutique République',
    actionLink: 'https://fidelipro.com/dashboard',
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
  backgroundColor: '#EEF2FF',
}

const panelLabel = {
  margin: '0 0 4px',
  color: '#4F46E5',
  fontSize: '12px',
  fontWeight: '700',
  textTransform: 'uppercase' as const,
}

const panelValue = {
  margin: '0 0 6px',
  color: '#0F172A',
  fontSize: '20px',
  fontWeight: '800',
}

const panelText = {
  margin: 0,
  color: '#475569',
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

const caption = {
  margin: '20px 0 0',
  color: '#94A3B8',
  fontSize: '12px',
  lineHeight: '1.6',
}