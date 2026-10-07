'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/Dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/Accordion';
import { Switch } from '@/components/ui/Switch';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { CopyButton } from '@/components/ui/CopyButton';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import { UpgradeNudge } from '@/components/ui/UpgradeNudge';
import { UsageMeter } from '@/components/ui/UsageMeter';
import { Shield } from 'lucide-react';

export default function DevUiGalleryPage() {
  const [switchChecked, setSwitchChecked] = useState(false);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 48 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, margin: '0 0 8px' }}>
          ZERIVEX UI Kit Sandbox (Ember & Paper)
        </h1>
        <p style={{ color: 'var(--ds-text-secondary)', fontSize: 15 }}>
          Dev-only verification surface testing every Radix and token-driven UI component across states.
        </p>
      </div>

      {/* Buttons */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Buttons (Brand, Secondary, Ghost, Inverse)</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="brand" size="md">Brand Action (AA Ink on Ember)</Button>
          <Button variant="secondary" size="md">Secondary Button</Button>
          <Button variant="ghost" size="md">Ghost Button</Button>
          <Button variant="inverse" size="md">Inverse Terminal</Button>
          <Button variant="brand" size="sm">Small Brand</Button>
          <Button variant="brand" size="lg">Large Brand</Button>
          <Button variant="secondary" size="md" disabled>Disabled State</Button>
        </div>
      </section>

      {/* Badges & Severity */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Badges & Severity Chips</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge variant="default">Default</Badge>
          <Badge variant="mint">Mint Sticker</Badge>
          <Badge variant="butter">Butter Sticker</Badge>
          <Badge variant="lilac">Lilac Sticker</Badge>
          <Badge variant="danger">Danger</Badge>
          <SeverityBadge severity="CRITICAL" />
          <SeverityBadge severity="HIGH" />
          <SeverityBadge severity="MEDIUM" />
          <SeverityBadge severity="LOW" />
          <SeverityBadge severity="INFO" />
        </div>
      </section>

      {/* Score Gauges */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Score Gauges (GSAP Sweep)</h2>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <ScoreGauge score={94} size={72} />
          <ScoreGauge score={82} size={72} />
          <ScoreGauge score={74} size={72} />
          <ScoreGauge score={45} size={72} />
        </div>
      </section>

      {/* Cards */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Cards (Paper & Ink Island)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <Card interactive>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>Interactive Paper Card</h3>
            <p style={{ fontSize: 14, color: 'var(--ds-text-secondary)', margin: 0 }}>
              Tilts slightly and casts sticker shadow on hover.
            </p>
          </Card>
          <Card variant="ink">
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: 'var(--ds-text-on-ink)' }}>Dark Terminal Island</h3>
            <p style={{ fontSize: 14, color: 'var(--ds-text-on-ink-dim)', margin: 0 }}>
              Deep black surface for technical ciphers and execution output.
            </p>
          </Card>
        </div>
      </section>

      {/* Code Block & Copy Button */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>CodeBlock & Copy Button Morph</h2>
        <CodeBlock
          filename="next.config.mjs"
          language="javascript"
          code={`// Secure Transport Configuration
export default {
  async headers() {
    return [{
      source: '/:path*',
      headers: [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    }];
  }
};`}
        />
        <div style={{ marginTop: 12 }}>
          <CopyButton value="curl -I https://zerivex.com/.well-known/security.txt" label="Copy CLI Probe" />
        </div>
      </section>

      {/* Tabs & Switch */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Radix Tabs & Switch</h2>
        <Tabs defaultValue="nextjs">
          <TabsList>
            <TabsTrigger value="nextjs">Next.js</TabsTrigger>
            <TabsTrigger value="express">Express</TabsTrigger>
            <TabsTrigger value="nginx">Nginx</TabsTrigger>
          </TabsList>
          <TabsContent value="nextjs" style={{ padding: '16px 0' }}>
            <p style={{ fontSize: 14, color: 'var(--ds-text-secondary)' }}>Next.js 15 App Router remediation pattern active.</p>
          </TabsContent>
          <TabsContent value="express" style={{ padding: '16px 0' }}>
            <p style={{ fontSize: 14, color: 'var(--ds-text-secondary)' }}>Express middleware helmet pattern active.</p>
          </TabsContent>
          <TabsContent value="nginx" style={{ padding: '16px 0' }}>
            <p style={{ fontSize: 14, color: 'var(--ds-text-secondary)' }}>Nginx ssl_protocols & ciphers directive active.</p>
          </TabsContent>
        </Tabs>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <Switch checked={switchChecked} onCheckedChange={setSwitchChecked} id="demo-switch" />
          <label htmlFor="demo-switch" style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Toggle continuous monitoring alert
          </label>
        </div>
      </section>

      {/* Accordion & Dialog */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Accordion & Dialog</h2>
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>What makes Zerivex different from generic scanners?</AccordionTrigger>
            <AccordionContent>
              100% deterministic security evidence with zero synthetic false positives, cryptographic target ownership verification, and exact multi-framework code diffs.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Why is target ownership verification required?</AccordionTrigger>
            <AccordionContent>
              To protect ethical boundaries and prevent unauthorized invasive probes against endpoints you do not own.
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div style={{ marginTop: 16 }}>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open Radix Dialog</Button>
            </DialogTrigger>
            <DialogContent title="Verify Target Ownership" description="Select your preferred challenge method to unlock active scans.">
              <p style={{ fontSize: 14, color: 'var(--ds-text-secondary)' }}>
                DNS TXT challenge token: <code style={{ fontFamily: 'var(--font-mono)' }}>zx_verify_9f8e7d6c5b4a3...</code>
              </p>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {/* Upgrade Nudges & Usage Meters */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Upgrade Nudges & Usage Meters</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <UpgradeNudge
            severity="soft"
            attempted="Scheduled Continuous Scans"
            reason="Automated recurring monitoring is included on the Team Pro plan."
            requiredPlanId="TEAM_PRO"
            benefit="Catch regressions before customers notice with daily or weekly background checks."
          />
          <UpgradeNudge
            severity="blocked"
            attempted="Target Quota Exceeded"
            reason="You have reached the maximum of 1 verified target on the Free Developer plan."
            requiredPlanId="TEAM_PRO"
            benefit="Monitor up to 5 verified applications simultaneously."
          />
          <UsageMeter label="Monthly Scans" current={8} max={10} unit="scans" />
          <UsageMeter label="Verified Targets" current={1} max={1} unit="target" />
        </div>
      </section>

      {/* Skeleton & Empty State */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Skeleton & Empty State</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <Skeleton height={28} width="60%" />
          <Skeleton height={18} width="90%" />
          <Skeleton height={18} width="40%" />
        </div>

        <EmptyState
          icon={<Shield size={24} />}
          title="No Monitored Targets Yet"
          description="Register your first website or API endpoint to begin automated vulnerability auditing."
          actionLabel="Register New Target"
          actionHref="/dashboard/targets"
        />
      </section>
    </div>
  );
}
