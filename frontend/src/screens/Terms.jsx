import PageContainer from "../components/layout/PageContainer";

export default function Terms() {
  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
        <div className="p-4 mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-semibold">
          Draft — Needs review by the project owner
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-4">Terms of Service</h1>
        <p className="text-slate-400 text-sm mb-8">Last updated: November 2026</p>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using DevCollab, you agree to be bound by these Terms of Service. If you do not agree,
              do not access or use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Acceptable Use</h2>
            <p className="mb-2">You agree not to use DevCollab to:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Compile, execute, or distribute malware, viruses, or exploitative code.</li>
              <li>Attempt to bypass rate limits, access controls, or sandbox boundaries.</li>
              <li>Abuse shared computational resources or external API quotas (e.g. Wandbox runner or AI review limits).</li>
              <li>Harass, impersonate, or infringe upon the intellectual property rights of other developers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. External Service Disclaimers</h2>
            <p className="mb-2">
              Code execution is provided as a best-effort developer convenience via public sandboxes (such as Wandbox).
              DevCollab makes no guarantee of execution uptime, non-preemption, or execution speed.
            </p>
            <p>
              AI review recommendations are advisory and generated automatically by large language models. You remain
              solely responsible for verifying and testing all code before deploying to production systems.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Workspace Ownership & Permissions</h2>
            <p>
              Workspace creators hold the `owner` role, retaining full authority over workspace membership, code snapshots,
              invitations, and room deletion. You are responsible for granting roles (`editor`, `viewer`) responsibly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Disclaimer of Warranties</h2>
            <p>
              DevCollab is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express
              or implied.
            </p>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
