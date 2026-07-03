import { TopBar, Footer } from "@/components/ln/nav";
import { LegalPage } from "@/components/ln/legal";

export const metadata = { title: "Terms · LinerNotes" };

export default function TermsPage() {
  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar />
      <LegalPage title="Terms of Use" updated="July 2026">
        <p>
          LinerNotes is in private beta. By creating an account you agree to these terms, which we may
          update as the product evolves.
        </p>
        <h2>Your account</h2>
        <p>
          You&apos;re responsible for what you post and for keeping your login secure. Use a real email so we can
          reach you about your account.
        </p>
        <h2>Your content</h2>
        <p>
          You keep ownership of the notes you write. By posting, you grant LinerNotes permission to display
          your notes within the app according to your account&apos;s privacy setting (public or private).
        </p>
        <h2>Acceptable use</h2>
        <ul>
          <li>Don&apos;t post unlawful, harmful, or infringing content.</li>
          <li>Don&apos;t abuse, harass, or impersonate others.</li>
          <li>Don&apos;t attempt to disrupt or reverse-engineer the service.</li>
        </ul>
        <h2>Beta software</h2>
        <p>
          Features may change, break, or disappear during the beta, and the service is provided &quot;as is&quot;
          without warranties. We may suspend accounts that violate these terms.
        </p>
        <h2>Contact</h2>
        <p>Questions? Email <a href="mailto:hello@linernotes.app">hello@linernotes.app</a>.</p>
      </LegalPage>
      <Footer />
    </div>
  );
}
