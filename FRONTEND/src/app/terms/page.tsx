import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use | Elzuron",
  description: "The terms that apply when you use the Elzuron hiring platform.",
};

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "Accepting these terms",
    body: (
      <>
        <p>
          These Terms of Use govern your use of MAATA, the hiring platform operated by <strong>Nextenti</strong>. By creating an account or using
          the service you agree to them. If you use MAATA on behalf of an organisation, you confirm you are authorised to bind it. If you do not
          agree, please do not use the service.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "The service",
    body: (
      <>
        <p>
          MAATA lets employers post roles, manage a candidate pool, run AI screening interviews and live video interviews, schedule rounds, send
          offers and review reports. Candidates can apply for roles, take interviews and view their scorecards. Features may change over time.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts",
    body: (
      <>
        <ul>
          <li>Provide accurate information and keep it up to date.</li>
          <li>Keep your password confidential. You are responsible for activity under your account.</li>
          <li>A candidate account must be verified with the email address your interview invitation was sent to.</li>
          <li>Tell us promptly if you believe your account has been accessed without permission.</li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>break the law, or infringe anyone&apos;s rights, when using MAATA;</li>
          <li>impersonate another person, share an interview link so someone else can take your place, or give false information;</li>
          <li>use AI assistants, scripts or other outside help in a proctored interview where it is forbidden, or try to defeat proctoring;</li>
          <li>upload malware, probe or attack the service, scrape it, or overload it;</li>
          <li>use the platform to discriminate unlawfully against any person or group.</li>
        </ul>
      </>
    ),
  },
  {
    id: "employers",
    title: "Employer responsibilities",
    body: (
      <>
        <ul>
          <li>You are responsible for the lawfulness of your hiring process and for having a valid basis to process candidate data.</li>
          <li>
            AI scores and summaries are decision support only. You must not rely on them as the sole basis for a decision and must apply human
            judgement.
          </li>
          <li>You must give candidates required notices and obtain required consents, including for recording where the law requires it.</li>
          <li>Only invite people you have a legitimate reason to contact, and keep candidate information confidential.</li>
        </ul>
      </>
    ),
  },
  {
    id: "candidates",
    title: "Candidate responsibilities",
    body: (
      <>
        <ul>
          <li>Answer interviews yourself and honestly, in the time and manner the interview requires.</li>
          <li>
            For proctored bot interviews, keep your camera and screen share on. The interview ends automatically if you switch tabs or windows,
            your face is not visible, or sharing stops.
          </li>
          <li>You must accept the consent form to take an interview. You can decline, but the interview will not proceed.</li>
        </ul>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI features",
    body: (
      <>
        <p>
          Questions, transcripts, scores and summaries are generated with the help of AI and may contain errors or omissions. They are provided
          as-is to assist people and are not a guarantee of a candidate&apos;s ability or fit.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>
          You keep ownership of the content you submit (such as job descriptions, candidate records and interview answers). You give Nextenti a
          limited licence to host, process and display it solely to provide and secure the service, and as described in our{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "Our intellectual property",
    body: (
      <>
        <p>
          MAATA, Nextenti, their logos and the software and design of the platform belong to Nextenti and its licensors. These terms do not give
          you any rights to them beyond using the service as intended.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    body: (
      <>
        <p>
          We work to keep MAATA available but do not promise uninterrupted or error-free service. We may update, suspend or discontinue parts of
          the service, and we may update these terms. If a change is material we will tell you, and continued use means you accept it.
        </p>
      </>
    ),
  },
  {
    id: "disclaimer",
    title: "Disclaimers and liability",
    body: (
      <>
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind to the fullest extent
          permitted by law. To the extent the law allows, Nextenti is not liable for indirect, incidental or consequential losses, loss of
          profits or data, or for hiring decisions made using the service. Nothing in these terms limits liability that cannot be limited by law.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    title: "Suspension and termination",
    body: (
      <>
        <p>
          You may stop using MAATA at any time. We may suspend or end access if you breach these terms, put the service or other users at risk,
          or where required by law. Sections that by their nature should survive termination will do so.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <>
        <p>
          These terms are governed by the laws of the jurisdiction in which Nextenti is established, and its courts have jurisdiction, unless
          mandatory consumer law in your country says otherwise.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <>
        <p>
          Questions about these terms: <a href="mailto:legal@nextenti.ai">legal@nextenti.ai</a>.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro="The rules for using MAATA: for employers running hiring, and for candidates taking part in interviews."
      updated="October 27, 2026"
      sections={sections}
      other={{ href: "/privacy", label: "Read the Privacy Policy" }}
    />
  );
}
