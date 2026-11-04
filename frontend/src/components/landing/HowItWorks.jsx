import PageContainer from "../layout/PageContainer";
import Card from "../ui/Card";
import {
  CreateWorkspaceIllustration,
  WriteAndRunIllustration,
  ShareAndReviewIllustration,
} from "./FeatureIllustrations";

const STEPS = [
  {
    step: "01",
    title: "Create a workspace",
    text: "Give it a name and pick C++, JavaScript, Python, or Java with zero local installation.",
    illustration: CreateWorkspaceIllustration,
  },
  {
    step: "02",
    title: "Write and run",
    text: "Use the Monaco editor with syntax highlighting, auto-indent, and run with sub-second execution.",
    illustration: WriteAndRunIllustration,
  },
  {
    step: "03",
    title: "Share and review",
    text: "Send the room link to your team. Edit together, see live peer cursors, and comment directly on any line.",
    illustration: ShareAndReviewIllustration,
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 border-t border-line/60 bg-surface/30">
      <PageContainer>
        {/* Section Header */}
        <div className="flex flex-col items-center text-center mb-12">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-3">
            Workflow Overview
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-fg">
            How it works
          </h2>
          <p className="text-xs sm:text-sm text-muted mt-2 max-w-lg">
            DevCollab makes multiplayer coding and peer review effortless in 3 simple steps.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => {
            const Illustration = step.illustration;
            return (
              <Card
                key={step.title}
                className="group overflow-hidden rounded-2xl border border-line bg-surface hover:border-fg/20 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Step Visual Picture / Preview */}
                  <Illustration />

                  <div className="p-5 sm:p-6 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-surface-2 border border-line text-muted">
                        STEP {step.step}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-fg group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {step.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-muted leading-relaxed">
                      {step.text}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </PageContainer>
    </section>
  );
}
