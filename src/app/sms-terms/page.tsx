import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Terms & Conditions — St. Clement Strawberry Festival",
};

export default function SmsTermsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <article className="panel rounded-2xl border border-strawberry-100 bg-card p-6 text-foreground">
        <h1 className="text-3xl font-black text-strawberry-900">SMS Terms &amp; Conditions</h1>
        <p className="mt-1 text-sm text-foreground/70">
          St. Clement Strawberry Festival — Volunteer Alerts · Last updated August 28, 2026
        </p>

        <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
          <p>
            These terms govern the St. Clement Strawberry Festival Volunteer Alerts text-messaging
            program. By opting in, you agree to these terms.
          </p>

          <h2 className="text-lg font-bold text-strawberry-900">Program description</h2>
          <p>
            Volunteers who opt in receive SMS messages about volunteer scheduling — signup
            confirmations and day-before shift reminders — from the St. Clement Strawberry Festival.
          </p>

          <h2 className="text-lg font-bold text-strawberry-900">How to opt in</h2>
          <p>
            You opt in by checking the &ldquo;OK to text me&rdquo; box on our volunteer signup form
            at <span className="whitespace-nowrap">festival2026-ten.vercel.app/signup</span> and
            submitting your signup. Providing consent to receive texts is <strong>not</strong> a
            condition of volunteering.
          </p>

          <h2 className="text-lg font-bold text-strawberry-900">Message frequency &amp; cost</h2>
          <p>
            Message frequency varies (typically a confirmation at signup and reminders around the
            festival). <strong>Message and data rates may apply</strong> depending on your mobile
            carrier and plan.
          </p>

          <h2 className="text-lg font-bold text-strawberry-900">Opt out &amp; help</h2>
          <p>
            You can cancel at any time by replying <strong>STOP</strong> to any message; you will
            receive one confirmation and then no further messages. For help, reply{" "}
            <strong>HELP</strong> or contact a festival coordinator.
          </p>

          <h2 className="text-lg font-bold text-strawberry-900">Carriers</h2>
          <p>
            Mobile carriers are not liable for delayed or undelivered messages.
          </p>

          <h2 className="text-lg font-bold text-strawberry-900">Privacy</h2>
          <p>
            Your mobile number and opt-in information are used only to send volunteer scheduling
            messages and are never shared with third parties for marketing. See our{" "}
            <a href="/privacy" className="underline">
              Privacy Policy
            </a>{" "}
            for details.
          </p>
        </div>
      </article>
    </div>
  );
}
