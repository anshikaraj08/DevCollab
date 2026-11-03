import Card from "./Card";
 
export default function EmptyState({ title, text, action }) {
  return (
    <Card className="border-dashed px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  );
}

