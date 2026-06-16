import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default function NewClientPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">New Client</h1>
      <p className="mt-1 text-sm text-muted">
        The website URL does most of the work. Paste it, analyze, then confirm.
      </p>
      <div className="mt-8">
        <OnboardingForm />
      </div>
    </main>
  );
}
