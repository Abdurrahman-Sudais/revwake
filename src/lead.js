// Early-access lead handling. HubSpot portal and form IDs are public identifiers (they appear in any
// HubSpot embed), not secrets, so they can live in VITE_ variables. Leave them unset to keep the
// form in email-draft mode. Field names match docs/crm-plan.md.

export function hubspotConfig(env = import.meta.env || {}) {
  const portalId = env.VITE_HUBSPOT_PORTAL_ID, formGuid = env.VITE_HUBSPOT_FORM_GUID;
  if (!portalId || !formGuid) return null;
  return { portalId, formGuid, marketingSubscriptionTypeId: env.VITE_HUBSPOT_MARKETING_SUBSCRIPTION_ID || '' };
}

export function validateLead(f) {
  if (!f.name.trim() || !f.company.trim()) return 'Please complete your name and company.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return 'Please enter a valid work email.';
  if (!f.challenge.trim()) return 'Please describe your specification-change challenge briefly.';
  if (!f.consent) return 'Please agree that we may use your details to reply.';
  return '';
}

/** HubSpot Forms API v3 payload. */
export function leadPayload(f, context, config = {}) {
  const [first, ...rest] = f.name.trim().split(/\s+/);
  const fields = [
    ['firstname', first], ['lastname', rest.join(' ')], ['email', f.email.trim()], ['company', f.company.trim()],
    ['jobtitle', f.role], ['manufacturing_category', f.category], ['monthly_revisions', f.volume], ['change_challenge', f.challenge.trim()],
  ].filter(([, v]) => v).map(([name, value]) => ({ objectTypeId: '0-1', name, value }));
  return {
    fields, context,
    legalConsentOptions: { consent: {
      consentToProcess: true, text: 'I agree that Revwake may use these details to reply to this request.',
      communications: f.marketing && config.marketingSubscriptionTypeId ? [{ value: true, subscriptionTypeId: Number(config.marketingSubscriptionTypeId), text: 'Send me occasional product updates.' }] : [],
    } },
  };
}
