"use client";

import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPage() {
  const { d } = useLanguage();

  return (
    <>
      <PageHeader title={d.privacy.title} />

      <Card>
        <CardContent className="flex flex-col gap-6 pt-5">
          {d.privacy.sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1.5">
              <h2 className="font-display text-base font-semibold tracking-tight">{section.title}</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted">{section.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
