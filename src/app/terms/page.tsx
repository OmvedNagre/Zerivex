import { PolicyDocument } from '@/components/legal/PolicyDocument';
export const dynamic = 'force-dynamic';
export default function TermsPage() {
  return <PolicyDocument title="Terms of service">
    <h2>Service scope</h2><p>Zerivex performs scoped application-security checks and provides observations, remediation guidance and reports. Results cover the checks and endpoints successfully assessed. A clean result is not a guarantee that an application is secure, and a finding may require independent confirmation.</p>
    <h2>Authority to assess targets</h2><p>You must own each target or have permission from its owner. Ownership verification is required before active probes. Verification does not replace any authorization required by your hosting provider or another party. Do not use the service to access systems or data without permission.</p>
    <h2>Accounts and collaboration</h2><p>Keep your sign-in account, API keys and webhook secrets secure. Organization owners manage member permissions and should revoke access when it is no longer needed. You are responsible for the targets and destinations configured by your organization.</p>
    <h2>Plans, billing and scan credits</h2><p>Displayed plans define included scan allowances, features and limits. Stripe handles enabled subscription checkout and payment management. Cancellation at period end stops the next renewal after confirmation by Stripe; the existing paid period remains subject to subscription status. One additional scan credit funds one launch beyond the monthly allocation and does not unlock paid engines. Credits are consumed at launch, including launches that later fail to complete.</p>
    <h2>Acceptable use and suspension</h2><p>Abuse, unauthorized scanning, credential theft, service disruption and attempts to bypass safety restrictions are prohibited. Access may be restricted to protect the service or investigated targets. See the acceptable-use policy for examples.</p>
    <h2>Terms still requiring operator approval</h2><p>Operator identity, eligible customers, pricing and tax presentation, refunds, cancellation disclosures, service commitments, liability allocation, governing law and dispute procedures must be finalized and reviewed before public or paid launch. This draft does not invent those commitments.</p>
  </PolicyDocument>;
}
