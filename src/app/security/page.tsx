import Link from 'next/link';
import { CONTACT_EMAIL } from '@/lib/contact';
export default function SecurityPage() {
  return <main className="policy-document"><Link href="/">← Zerivex home</Link><h1>Report a security issue</h1>
    <p>Contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the affected URL, a description, and the minimum steps needed to reproduce the issue.</p>
    <p>Do not include live credentials or unnecessary personal information. Avoid disruptive testing, accessing another customer’s data, or testing third-party systems without permission.</p>
    <p>No bounty payment, response deadline or legal safe-harbor commitment is promised by this contact page.</p><Link href="/.well-known/security.txt">Machine-readable security contact</Link></main>;
}
