import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { PageHeader } from "@/components/ui/primitives";

export default function NewClientPage() {
  return (
    <div className="max-w-[800px] mx-auto space-y-8">
      <PageHeader
        eyebrow="Clients"
        title="New Client"
        meta="The website URL does most of the work. Paste it, analyze, then confirm."
      />
      <OnboardingForm />
    </div>
  );
}
