import PageContainer from "../components/layout/PageContainer";

export default function Privacy() {
  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
        <div className="p-4 mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-semibold">
          Draft — Needs review by the project owner
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-4">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-8">Last updated: November 2026</p>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Overview</h2>
            <p>
              DevCollab ("we", "our") is a real-time collaborative code editor platform. We are committed to
              protecting your privacy and ensuring transparent handling of your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong className="text-slate-200">Account Information:</strong> Name, email address, hashed passwords, and profile details.</li>
              <li><strong className="text-slate-200">Collaborative Workspaces:</strong> Real-time editor code documents, version snapshots, comments, and workspace test cases.</li>
              <li><strong className="text-slate-200">Technical Logs:</strong> IP addresses, request IDs, and session cookies for rate-limiting, security headers, and error telemetry.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. Third-Party Code Processing Disclosures</h2>
            <p className="mb-2">
              To provide interactive compilation and automated analysis features, source code entered in DevCollab may be transmitted to external providers:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li>
                <strong className="text-slate-200">Code Execution (Wandbox API):</strong> When you click "Run", your code and optional standard input (`stdin`) are sent to Wandbox over secure HTTPS for compilation and execution. Wandbox processes code ephemerally according to their public service terms.
              </li>
              <li>
                <strong className="text-slate-200">AI Code Review (Anthropic / OpenAI):</strong> When you request an AI Code Review, the active code snippet is sent to the configured AI API provider to generate actionable review findings. Code contents are never used to train foundational AI models without consent.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Cookies and Sessions</h2>
            <p>
              We use secure, HttpOnly cookies for authentication refresh tokens. In cross-site deployment environments (such as free Vercel frontend and Render backend subdomains), cookies are transmitted with `SameSite=None; Secure`.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Data Retention & Deletion</h2>
            <p>
              Workspace owners can delete rooms, version snapshots, and comments at any time, which permanently removes them from database storage.
            </p>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
