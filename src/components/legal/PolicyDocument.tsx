import Link from 'next/link';
import { CONTACT_EMAIL } from '@/lib/contact';
export function PolicyDocument({ title, children }: { title: string; children: React.ReactNode }) {
  const operator = process.env.LEGAL_OPERATOR_NAME;
  const jurisdiction = process.env.LEGAL_JURISDICTION;
  const approved = process.env.LEGAL_POLICIES_APPROVED === 'true' && Boolean(operator && jurisdiction);
  return <main className="policy-document">
    <Link href="/">← Zerivex home</Link><h1>{title}</h1>
    {!approved && <aside role="note"><strong>Draft for review.</strong> These policies have not been approved for public or paid service use. Operator identity and applicable legal terms must be confirmed before launch.</aside>}
    <dl><dt>Operator</dt><dd>{operator || 'Pending — service operator to be confirmed'}</dd><dt>Contact</dt><dd><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></dd><dt>Country/state for legal review</dt><dd>{jurisdiction || 'Pending — to be confirmed by the operator'}</dd></dl>
    {children}
    <footer><Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/acceptable-use">Acceptable use</Link> · <Link href="/security">Security contact</Link></footer>
  </main>;
}
