import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Krafziel",
  description: "How Krafziel collects, uses and protects personal data in the Krafziel hiring platform.",
};

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          MAATA is a hiring platform operated by <strong>Nextenti</strong> (&ldquo;Nextenti&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). It lets
          employers source candidates, run AI screening interviews and live video interviews, and make hiring decisions in one place.
        </p>
        <p>
          For the personal data of employer staff and of candidates who use our platform, Nextenti is the controller. For candidate records an
          employer uploads or collects, the employer is the controller and Nextenti acts on its behalf as a processor.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "Information we collect",
    body: (
      <>
        <p>Depending on how you use MAATA, we collect:</p>
        <ul>
          <li>
            <strong>Account details:</strong> name, email address, password (stored hashed), role (employer, candidate or administrator) and the
            organisation you belong to.
          </li>
          <li>
            <strong>Candidate and application data:</strong> contact details, résumé links, job applications, notes, interview scheduling and
            offer information.
          </li>
          <li>
            <strong>Interview data:</strong> your typed or spoken answers, transcripts of bot interviews, live-call captions, audio and video
            recordings, and the scores and summaries produced from them.
          </li>
          <li>
            <strong>Identity and proctoring data:</strong> a camera snapshot taken when you join an interview, and signals used to keep proctored
            interviews fair, such as whether the camera and screen share are active, tab or window switches, and whether a face is visible.
          </li>
          <li>
            <strong>Technical data:</strong> device and browser type, IP address, log data and cookies or similar storage needed to keep you signed
            in and the service working.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use information",
    body: (
      <>
        <ul>
          <li>To provide the platform: create accounts, schedule and run interviews, and show results to the hiring team.</li>
          <li>To generate interview questions and to evaluate answers with AI, producing scorecards for employers and candidates.</li>
          <li>To keep interviews fair and to detect impersonation or misuse, using the snapshot and proctoring signals described above.</li>
          <li>To send service emails such as interview invitations, confirmations and password resets, and in-app notifications.</li>
          <li>To secure, maintain and improve the service, and to meet legal obligations.</li>
        </ul>
        <p>We do not sell personal data, and we do not use interview recordings or answers to advertise to you.</p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: (
      <>
        <p>
          Interview answers and transcripts are sent to a third-party AI provider to generate questions and to produce evaluation scores and
          summaries. Scores are decision support for the hiring team, not a final decision: employers are responsible for reviewing the full
          picture and for any hiring decision they make.
        </p>
        <p>
          We ask AI providers to process this data only to deliver the result to us. If you would like a human to review an AI-scored interview,
          contact the employer that invited you or write to us at the address below.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <ul>
          <li>
            <strong>The employer</strong> you apply to or interview with, and its authorised team members, who can see your candidate record,
            answers, scores, snapshots and recordings.
          </li>
          <li>
            <strong>Service providers</strong> that help us run MAATA: hosting and storage, email delivery, video relay (TURN) servers and AI
            providers. They may only use data to provide their service to us.
          </li>
          <li>
            <strong>Authorities or advisers</strong> where required by law, or to protect rights, safety and the integrity of the service.
          </li>
          <li>A successor, if Nextenti is involved in a merger or sale, subject to this policy.</li>
        </ul>
      </>
    ),
  },
  {
    id: "consent",
    title: "Recording, consent and proctoring",
    body: (
      <>
        <p>
          Before a bot interview or a live video interview, candidates are shown a consent form covering recording and AI evaluation, proctoring
          and the identity snapshot, and data storage and retention. You must accept it to take part. If you decline, the interview does not
          proceed.
        </p>
        <p>
          Live-call recordings are made from each participant&apos;s own camera and uploaded to our servers. Proctored bot interviews end
          automatically if you switch tabs, your face is not visible or screen sharing stops.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep data",
    body: (
      <>
        <p>
          We keep personal data for as long as the employer&apos;s account is active and as needed to provide the service, then delete or
          anonymise it within a reasonable period. Employers control how long candidate records, recordings and snapshots are retained within
          their account. We may keep limited data longer where the law requires, or to resolve disputes and enforce our agreements.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <>
        <p>
          We use measures such as hashed passwords, access controls limited to the people who need the data, encrypted connections and
          separation between organisations. No system is perfectly secure, so please use a strong, unique password and tell us straight away if
          you suspect unauthorised access.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your choices and rights",
    body: (
      <>
        <p>
          Depending on where you live, you may have the right to access, correct, delete or export your personal data, to object to or restrict
          certain processing, and to withdraw consent. To exercise a right, contact us or the employer that holds your candidate record. We will
          respond within the time the law requires. You may also complain to your local data protection authority.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <>
        <p>
          Our providers may process data in countries other than your own. Where we transfer personal data internationally we use appropriate
          safeguards, such as contractual protections, as required by applicable law.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <>
        <p>MAATA is for working-age adults and is not directed at children. We do not knowingly collect data from anyone under 16.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <>
        <p>
          We may update this policy as the product or the law changes. When we make a material change we will update the date above and, where
          appropriate, notify you in the app or by email.
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
          Questions or requests about privacy: <a href="mailto:privacy@nextenti.ai">privacy@nextenti.ai</a>.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="What we collect when you use MAATA, why we collect it, who sees it, and the choices you have."
      updated="October 27, 2026"
      sections={sections}
      other={{ href: "/terms", label: "Read the Terms of Use" }}
    />
  );
}
