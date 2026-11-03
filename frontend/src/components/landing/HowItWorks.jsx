import PageContainer from "../layout/PageContainer";
import Card from "../ui/Card";
 
const STEPS = [
  { title: "Create a workspace", text: "Give it a name and pick C++, JavaScript, Python or Java." },
  { title: "Write and run", text: "Use the Monaco editor and run your code in one click." },
  { title: "Share and review", text: "Send the link. Edit together, see each other's cursors and comment on any line." },
];
 
export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16">
      <PageContainer>
        <h2 className="text-2xl font-extrabold tracking-tight">How it works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Card key={step.title} className="p-6">
              <p className="font-mono text-xs text-faint">0{index + 1}</p>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted">{step.text}</p>
            </Card>
          ))}
        </div>
      </PageContainer>
    </section>
  );
}

