import { TopBar, Footer } from "@/components/ln/nav";
import { LegalPage } from "@/components/ln/legal";

export const metadata = { title: "Privacy · LinerNotes" };

export default function PrivacyPage() {
  return (
    <div style={{ background: "var(--ln-bg)", color: "var(--ln-fg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar />
      <LegalPage title="Privacy Policy" updated="July 2026">
        <p>
          LinerNotes is a listening journal in private beta. This page explains, in plain terms,
          what we collect and how your notes are shared. It will be expanded before general release.
        </p>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account details</strong> — your email, display name, and handle.</li>
          <li><strong>Your notes</strong> — the tracks you log, ratings, timestamped moments, and any text you add.</li>
          <li>
            <strong>Optional listening connections</strong> — if you connect Last.fm or Spotify, we use it
            only to suggest what to write about. No listening account is required to use LinerNotes.
          </li>
        </ul>
        <h2>Who can see your notes</h2>
        <ul>
          <li>
            <strong>Public accounts</strong> (the default) appear in the community feed, and your profile
            and notes are viewable by anyone.
          </li>
          <li>
            <strong>Private accounts</strong> are hidden from the community feed. Only friends whose requests
            you&apos;ve accepted can see your profile and notes.
          </li>
          <li>
            A single note you choose to share by link can be opened by anyone who has that link, even if your
            account is private. It is unlisted, not secret — only share links you&apos;re comfortable being seen.
          </li>
        </ul>
        <h2>What we don&apos;t do</h2>
        <p>We don&apos;t sell your data, and we don&apos;t post anything on your behalf without you choosing to.</p>
        <h2>Contact</h2>
        <p>Questions about your data? Email <a href="mailto:privacy@linernotes.app">privacy@linernotes.app</a>.</p>
      </LegalPage>
      <Footer />
    </div>
  );
}
