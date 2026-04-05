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

interface MerchantWelcomeProps {
  businessName?: string
  email?: string
}

const MerchantWelcomeEmail = ({ businessName, email }: MerchantWelcomeProps) => {
  const safeBusinessName = businessName || 'Votre commerce'

  return (
    <Html lang="fr">
      <Head />
      <Preview>Bienvenue sur FidéliPro</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>FidéliPro</Text>
          <Heading style={title}>Bienvenue à bord 🎉</Heading>
          <Text style={text}>
            Votre espace commerçant est prêt. Vous pouvez maintenant lancer votre programme de fidélité et commencer à suivre vos clients.
          </Text>
          <Section style={panel}>
            <Text style={panelLabel}>Compte activé</Text>
            <Text style={panelValue}>{safeBusinessName}</Text>
            {email ? <Text style={panelText}>{email}</Text> : null}
          </Section>
          <Text style={listTitle}>Vous pouvez maintenant :</Text>
          <Text style={listItem}>• Configurer vos récompenses et votre carte digitale</Text>
          <Text style={listItem}>• Scanner vos clients en boutique</Text>
          <Text style={listItem}>• Suivre vos résultats depuis le dashboard</Text>
          <Button href="https://fidelipro.com/dashboard" style={button}>
            Accéder à mon espace
          </Button>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: MerchantWelcomeEmail,
  subject: ({ businessName }: Record<string, any>) =>
    `Bienvenue sur FidéliPro${businessName ? `, ${businessName}` : ''} !`,
  displayName: 'Bienvenue commerçant',
  previewData: {
    businessName: 'Maison Lina',
    email: 'contact@maison-lina.fr',
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

const listTitle = {
  margin: '0 0 10px',
  color: '#0F172A',
  fontSize: '15px',
  fontWeight: '700',
}

const listItem = {
  margin: '0 0 8px',
  color: '#475569',
  fontSize: '14px',
  lineHeight: '1.6',
}

const button = {
  marginTop: '18px',
  backgroundColor: '#4F46E5',
  borderRadius: '999px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '700',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}