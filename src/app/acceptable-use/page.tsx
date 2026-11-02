import { PolicyDocument } from '@/components/legal/PolicyDocument';
export const dynamic = 'force-dynamic';
export default function AcceptableUsePage() {
  return <PolicyDocument title="Acceptable-use policy">
    <h2>Authorized testing only</h2><p>Register targets only when you have authority to assess them. Keep testing within the verified host and URL scope. Obtain permission for production testing and confirm any hosting-provider conditions.</p>
    <h2>Prohibited actions</h2><ul><li>Scanning third-party systems without permission or submitting misleading ownership proofs.</li><li>Attempting to reach private networks, cloud metadata services or prohibited ports through Zerivex.</li><li>Exfiltrating credentials, personal information or other data beyond what is necessary to document an authorized finding.</li><li>Deliberately disrupting a target, bypassing rate limits, or using scans for harassment, fraud or unlawful activity.</li><li>Publishing another organization’s confidential findings or sharing access credentials without authorization.</li></ul>
    <h2>Handling findings</h2><p>Use test accounts and non-sensitive data where possible. Do not place passwords or API tokens in target URLs. Limit report access to people responsible for remediation and follow the target owner’s disclosure process.</p>
  </PolicyDocument>;
}
