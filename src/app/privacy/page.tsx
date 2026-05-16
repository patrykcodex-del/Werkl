import Link from 'next/link';

export const metadata = {
    title: 'Privacy Policy — Werkl.ai',
    description: 'Privacy Policy for the Werkl.ai platform.',
};

const EFFECTIVE_DATE = 'May 16, 2026';

export default function PrivacyPage() {
    return (
        <div className="max-w-3xl mx-auto py-16 px-4">
            {/* Header */}
            <div className="mb-10">
                <p className="text-xs font-mono mb-3" style={{ color: 'var(--accent)' }}>Legal</p>
                <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Privacy Policy
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Effective date: {EFFECTIVE_DATE}
                </p>
            </div>

            <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>

                <section>
                    <p>
                        Werkl.ai (&ldquo;Werkl&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;)
                        is committed to protecting your personal information. This Privacy Policy explains what data
                        we collect, how we use it, and the choices you have.
                    </p>
                </section>

                <Section title="1. Information We Collect">
                    <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                        Information you provide via OAuth sign-in
                    </p>
                    <p>
                        When you sign in with Google, GitHub, Discord, or another OAuth provider, we receive your
                        name, email address, and profile picture from that provider. We do not receive or store your
                        password.
                    </p>

                    <p className="font-medium mt-5 mb-2" style={{ color: 'var(--text-primary)' }}>
                        Information generated through platform use
                    </p>
                    <ul className="space-y-1.5 list-disc list-inside">
                        <li>Tasks you accept, complete, or release</li>
                        <li>Session activity and timestamps</li>
                        <li>Earnings and payout records</li>
                    </ul>

                    <p className="font-medium mt-5 mb-2" style={{ color: 'var(--text-primary)' }}>
                        Automatically collected information
                    </p>
                    <ul className="space-y-1.5 list-disc list-inside">
                        <li>IP address and general geographic region</li>
                        <li>Browser type and operating system</li>
                        <li>Pages visited and actions taken on the platform</li>
                    </ul>
                </Section>

                <Section title="2. How We Use Your Information">
                    <ul className="space-y-1.5 list-disc list-inside">
                        <li>To create and maintain your account</li>
                        <li>To match you with and deliver tasks</li>
                        <li>To calculate, record, and process your earnings and payouts</li>
                        <li>To communicate important platform updates or issues</li>
                        <li>To detect and prevent fraud, abuse, or violations of our Terms of Service</li>
                        <li>To improve the platform through aggregate, anonymised analytics</li>
                    </ul>
                    <p className="mt-3">
                        We do not sell your personal information to third parties.
                    </p>
                </Section>

                <Section title="3. Third-Party Services">
                    <p>We share data with the following categories of third parties only as necessary to operate the platform:</p>
                    <ul className="mt-3 space-y-3">
                        <li>
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>OAuth providers</span>
                            {' '}(Google, GitHub, Discord, etc.) — used for authentication only. Their privacy
                            policies govern data held on their platforms.
                        </li>
                        <li>
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Stripe</span>
                            {' '}— used to process payouts. Stripe may collect additional information directly from
                            you to comply with financial regulations. See{' '}
                            <a
                                href="https://stripe.com/privacy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:opacity-80"
                                style={{ color: 'var(--accent)' }}
                            >
                                Stripe&apos;s Privacy Policy
                            </a>.
                        </li>
                        <li>
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Infrastructure providers</span>
                            {' '}— hosting and database services used to store and process your data securely.
                        </li>
                    </ul>
                </Section>

                <Section title="4. Data Retention">
                    <p>
                        We retain your account data for as long as your account is active. Earnings and payout
                        records are retained for a minimum of 7 years to comply with financial and tax regulations.
                        You may request deletion of your account at any time (see Section 6), subject to retention
                        obligations.
                    </p>
                </Section>

                <Section title="5. Security">
                    <p>
                        We use industry-standard measures to protect your data, including encrypted connections
                        (HTTPS), hashed session tokens, and access controls. No system is perfectly secure; we
                        encourage you to use a strong, unique password with your OAuth provider and to enable
                        two-factor authentication where possible.
                    </p>
                </Section>

                <Section title="6. Your Rights">
                    <p>Depending on your jurisdiction, you may have the right to:</p>
                    <ul className="mt-2 space-y-1.5 list-disc list-inside">
                        <li>Access the personal data we hold about you</li>
                        <li>Request correction of inaccurate data</li>
                        <li>Request deletion of your account and associated data</li>
                        <li>Object to or restrict certain processing</li>
                        <li>Receive a portable copy of your data</li>
                    </ul>
                    <p className="mt-3">
                        To exercise any of these rights, contact us at{' '}
                        <a
                            href="mailto:privacy@werkl.ai"
                            className="underline hover:opacity-80"
                            style={{ color: 'var(--accent)' }}
                        >
                            privacy@werkl.ai
                        </a>.
                    </p>
                </Section>

                <Section title="7. Cookies">
                    <p>
                        We use a single session cookie to keep you signed in between page loads. We do not use
                        advertising or tracking cookies. You can clear this cookie at any time by signing out.
                    </p>
                </Section>

                <Section title="8. Children">
                    <p>
                        Werkl is not directed at children under 18 and we do not knowingly collect data from anyone
                        under that age. If you believe a minor has created an account, please contact us and we will
                        promptly delete it.
                    </p>
                </Section>

                <Section title="9. Changes to This Policy">
                    <p>
                        We may update this Privacy Policy from time to time. When we do, we will update the
                        effective date above. Continued use of the platform after changes are posted constitutes
                        your acceptance of the revised policy.
                    </p>
                </Section>

                <Section title="10. Contact">
                    <p>
                        Questions or concerns about this Privacy Policy should be directed to{' '}
                        <a
                            href="mailto:privacy@werkl.ai"
                            className="underline hover:opacity-80"
                            style={{ color: 'var(--accent)' }}
                        >
                            privacy@werkl.ai
                        </a>.
                    </p>
                </Section>

            </div>

            {/* Footer nav */}
            <div className="mt-16 pt-8 border-t flex gap-6 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <Link href="/terms" className="underline hover:opacity-80">Terms of Service</Link>
                <Link href="/" className="hover:opacity-80">← Back to Werkl</Link>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                {title}
            </h2>
            {children}
        </section>
    );
}
