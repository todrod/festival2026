import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — St. Clement Strawberry Festival",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <article className="panel rounded-2xl border border-strawberry-100 bg-card p-6 text-foreground">
        <h1 className="text-3xl font-black text-strawberry-900">Privacy Policy</h1>
        <p className="mt-1 text-sm text-foreground/70">
          St. Clement Strawberry Festival — volunteer scheduling · Last updated August 28, 2026
        </p>

        <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
          <p>
            This Privacy Policy explains how the St. Clement Strawberry Festival (&ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects and uses information from volunteers who
            sign up to help with the festival.
          </p>

          <h2 className="text-lg font-bold text-strawberry-900">Information we collect</h2>
          <p>
            When you sign up to volunteer, we collect the information you provide: your name, date of
            birth, email address, mobile phone number, emergency contact name and phone, your
            language preference, years of experience, availability, and role preferences.
          </p>

          <h2 className="text-lg font-bold text-strawberry-900">How we use your information</h2>
          <p>
            We use this information solely to organize and staff the festival — to build the
            volunteer schedule, assign shifts and roles, and communicate with you about your
            volunteering. Communication may be by email and, if you opt in, by text message (SMS).
          </p>

          <h2 className="text-lg font-bold text-strawberry-900">Text messaging (SMS)</h2>
          <p>
            If you check the &ldquo;OK to text me&rdquo; box during signup, you consent to receive
            SMS messages from us about volunteer scheduling — confirmations and shift reminders.
            Message frequency varies. Message and data rates may apply. You can opt out at any time
            by replying <strong>STOP</strong>, or get help by replying <strong>HELP</strong>.
          </p>
          <p className="rounded-lg border border-strawberry-100 bg-strawberry-50/60 p-3 dark:bg-strawberry-100/20">
            <strong>We do not sell, rent, or share your personal information with third parties for
            their marketing purposes.</strong> Mobile phone numbers and text-messaging opt-in
            information are used only to send you volunteer scheduling messages and are{" "}
            <strong>never shared with any third parties or affiliates for marketing or promotional
            purposes.</strong>
          </p>

          <h2 className="text-lg font-bold text-strawberry-900">How we protect and retain information</h2>
          <p>
            Volunteer information is kept within our scheduling system and used only by festival
            coordinators. We retain it for the purpose of organizing the festival and remove it when
            it is no longer needed for that purpose.
          </p>

          <h2 className="text-lg font-bold text-strawberry-900">Your choices</h2>
          <p>
            You may opt out of text messages at any time by replying STOP. To update or remove your
            volunteer information, or with any privacy questions, contact a festival coordinator.
          </p>

          <h2 className="text-lg font-bold text-strawberry-900">Contact</h2>
          <p>
            St. Clement Strawberry Festival — please contact the festival volunteer coordinator with
            any questions about this policy.
          </p>

          <p className="pt-2 text-xs text-foreground/60">
            See also our{" "}
            <a href="/sms-terms" className="underline">
              SMS Terms &amp; Conditions
            </a>
            .
          </p>
        </div>
      </article>
    </div>
  );
}
