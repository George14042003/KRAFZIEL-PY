/** Interview-process articles for candidates. Content lives in code so it ships with the app; add an entry to
 * ARTICLES (newest first) and it appears in the list, the article page and the sitemap of the candidate area. */

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "tip"; text: string };

export type Article = {
  slug: string;
  title: string;
  summary: string;
  category: "Process" | "Preparation" | "Technical" | "Offer & pay";
  readMinutes: number;
  /** ISO date the article was last reviewed against how interviews currently run. */
  updated: string;
  body: ArticleBlock[];
};

export const ARTICLES: Article[] = [
  {
    slug: "how-our-bot-interview-works",
    title: "How a bot interview works here, step by step",
    summary: "What happens from the invite to your scorecard, what is checked, and how to get through it calmly.",
    category: "Process",
    readMinutes: 5,
    updated: "2026-11-02",
    body: [
      { type: "p", text: "A bot interview is a recorded, one-sided screening round. An AI interviewer asks you a short set of questions, you answer in your own time, and the platform scores the answers so the hiring team can compare candidates fairly. There is no live person on the other end, but a real recruiter reviews the outcome." },
      { type: "h2", text: "Before you start" },
      { type: "ul", items: [
        "Confirm your availability from the email link first. The interview will not open until you do.",
        "Read and accept the consent screen. It explains recording, AI evaluation, proctoring and how long your data is kept.",
        "Choose how you will answer: typing or speaking. Speaking is optional and needs a browser with speech recognition, such as Chrome.",
      ] },
      { type: "h2", text: "Camera, screen share and friendly reminders" },
      { type: "p", text: "To keep the round fair for everyone, you are asked to turn on your camera and share your screen while you answer, so the employer can see it is really you. You can also do a quick, optional face check first: you look at the centre of the screen and then turn your face toward each of the four corners as they light up. Skipping it is completely fine." },
      { type: "ul", items: [
        "Stay on the interview page and keep your face towards the screen.",
        "If you switch tabs, turn away or leave the camera view, you get a short friendly reminder and a soft chime. Nothing ends your interview automatically.",
        "If screen sharing stops, you can carry on and share it again from the reminder.",
        "Please answer in your own words, without other AI tools.",
      ] },
      { type: "h2", text: "Answering" },
      { type: "p", text: "You get one question at a time, and one chance to revise each answer before moving on. At the end you review all your answers and submit. Scoring happens right after, so your scorecard may take a minute or two to appear." },
      { type: "h2", text: "What your scorecard shows" },
      { type: "p", text: "You will see scores out of 10 for communication, problem solving, culture fit and answer relevance, plus speaking confidence if you answered by voice, along with a written summary of strengths and concerns. Employers see the same breakdown along with a recommendation to help them decide." },
      { type: "tip", text: "Practise first. Mock interviews use the same style of questions and give instant feedback, with no proctoring and no effect on any real application." },
    ],
  },
  {
    slug: "modern-hiring-pipeline",
    title: "The modern hiring pipeline: what happens after you apply",
    summary: "From application to offer, the stages most companies run today and what each one is really testing.",
    category: "Process",
    readMinutes: 5,
    updated: "2026-11-02",
    body: [
      { type: "p", text: "Hiring processes differ between companies, but most follow the same shape. Knowing the stages helps you prepare for the right thing at the right time, and stops silence between rounds from feeling personal." },
      { type: "h2", text: "1. Application and screening" },
      { type: "p", text: "Your CV and answers are checked against the role's requirements, often with software that helps recruiters sort a large number of applications. Use the same keywords as the job description where they honestly describe you, keep formatting simple, and show results rather than duties." },
      { type: "h2", text: "2. Recruiter or HR conversation" },
      { type: "p", text: "A short call or message exchange to confirm your background, motivation, availability, notice period and pay expectations. It is a fit and logistics check. Be concise and have your salary range ready." },
      { type: "h2", text: "3. Screening interview" },
      { type: "p", text: "This is increasingly an asynchronous round: a bot interview or recorded video questions that you complete on your own schedule. It tests communication and relevance at scale, so every candidate gets the same questions." },
      { type: "h2", text: "4. Live interviews" },
      { type: "p", text: "One to three conversations with the hiring manager and team, usually by video. Expect behavioural questions about past work and, for many roles, a skills discussion or exercise." },
      { type: "h2", text: "5. Assessment or task" },
      { type: "p", text: "Some roles add a work sample, case study, coding task or presentation. Ask how long it should take and how it will be judged." },
      { type: "h2", text: "6. References, checks and offer" },
      { type: "p", text: "Companies may check references and employment history before sending a written offer. Offers can usually be discussed. Read the whole package before replying." },
      { type: "tip", text: "Ask the recruiter at each stage what comes next and roughly when you will hear back. It sets expectations and shows professionalism." },
    ],
  },
  {
    slug: "star-method-with-examples",
    title: "The STAR method: answer behavioural questions with structure",
    summary: "A simple four-part framework, a worked example, and the mistakes that sink otherwise good answers.",
    category: "Preparation",
    readMinutes: 6,
    updated: "2026-11-02",
    body: [
      { type: "p", text: "Behavioural questions start with phrases like 'Tell me about a time when…'. Interviewers ask them because past behaviour is the best available guide to how you will work. STAR gives your answer a shape so it is clear, complete and easy to score." },
      { type: "h2", text: "The four parts" },
      { type: "ul", items: [
        "Situation: set the scene in one or two sentences. Where, when, what was happening.",
        "Task: your responsibility or the goal. What needed to be achieved, and by you specifically.",
        "Action: what you did, step by step. This is the longest part, and it must say 'I', not just 'we'.",
        "Result: the outcome, ideally with a number, plus what you learned.",
      ] },
      { type: "h2", text: "A worked example" },
      { type: "p", text: "Question: Tell me about a time you improved a process." },
      { type: "p", text: "“At my last company, our onboarding emails had a 12% open rate (situation). I was responsible for lifting engagement before a product launch (task). I analysed three months of send data, found the subject lines were generic, rewrote them around the customer's goal, and ran an A/B test across 4,000 users (action). The winning version raised opens to 31% and cut support tickets by 18%. I learned to test before assuming (result).”" },
      { type: "h2", text: "Common mistakes" },
      { type: "ul", items: [
        "Spending most of the answer on the situation and rushing the action.",
        "Saying only 'we', so the interviewer cannot tell what you did.",
        "Ending without a result, or with a vague one such as 'it went well'.",
        "Choosing a story where nothing was at stake. Pick one with a real challenge.",
      ] },
      { type: "h2", text: "Build a story bank" },
      { type: "p", text: "Prepare five or six real stories: a success, a failure, a conflict, a time you led, a time you learned fast, a tight deadline. Most behavioural questions can be answered by reshaping one of them. Aim for roughly 90 seconds to two minutes spoken." },
      { type: "tip", text: "Use a behavioural mock interview: it checks whether your answer covers all four STAR parts and flags missing numbers and results." },
    ],
  },
  {
    slug: "one-way-and-async-video-interviews",
    title: "One-way video and async interviews: setup and technique",
    summary: "You are talking to a camera, not a person. Here is how to make that feel natural and look professional.",
    category: "Preparation",
    readMinutes: 4,
    updated: "2026-11-02",
    body: [
      { type: "p", text: "In an asynchronous interview you answer prepared questions on your own, and reviewers watch or read your answers later. Done well, it is the fairest first round: everyone gets the same questions and you choose the moment." },
      { type: "h2", text: "Set up your space" },
      { type: "ul", items: [
        "Face a window or lamp so light falls on your face. Avoid a bright window behind you.",
        "Put the camera at eye level and sit about an arm's length away, with your head and shoulders in frame.",
        "Choose a quiet room, close other apps and silence notifications.",
        "Test your camera, microphone and internet before you open the interview link.",
      ] },
      { type: "h2", text: "Speak to the lens" },
      { type: "p", text: "Look at the camera, not at your own picture, for the key parts of your answer. Smile when you start, speak a little slower than you would in conversation, and use short pauses instead of filler words." },
      { type: "h2", text: "Structure beats polish" },
      { type: "p", text: "Open with your main point, support it with one concrete example, and close with the result. If answers are timed, practise with a timer so you finish rather than get cut off." },
      { type: "h2", text: "Check the rules" },
      { type: "p", text: "Read the instructions for how many attempts you get, whether you can retake an answer, and what is not allowed. Some platforms are proctored and end the attempt if you leave the page." },
      { type: "tip", text: "Rehearse out loud at least twice. Reading answers in your head is not the same as saying them." },
    ],
  },
  {
    slug: "technical-interviews-what-to-expect",
    title: "Technical interviews: formats and how to prepare",
    summary: "Live coding, take-home tasks, system design and pair sessions: what each tests and how to practise.",
    category: "Technical",
    readMinutes: 6,
    updated: "2026-11-02",
    body: [
      { type: "p", text: "Technical hiring has moved toward showing real work and reasoning, not only recalling facts. You may meet more than one of the formats below in the same process." },
      { type: "h2", text: "Common formats" },
      { type: "ul", items: [
        "Live coding or problem solving: you solve a problem while explaining your thinking. Interviewers care about how you reason, test and recover from mistakes.",
        "Take-home task: a small project done in your own time. Keep it focused, readable and tested, and note your assumptions and what you would improve with more time.",
        "System or design discussion: you sketch how you would build something and justify trade-offs. Start by clarifying requirements, then cover data, scaling and failure.",
        "Pair or code review session: you work with an engineer on a real-looking codebase. Communication and collaboration matter as much as the answer.",
        "Domain interviews for non-engineering roles: analysts, marketers and finance candidates are often asked to walk through a case or interpret data.",
      ] },
      { type: "h2", text: "AI tools and the rules" },
      { type: "p", text: "Policies on AI assistants vary a lot. Some interviews forbid them, some allow them for specific tasks. Never assume. Read the instructions, and ask the recruiter if they are unclear. Where an interview is proctored, using unapproved tools can end the attempt." },
      { type: "h2", text: "How to prepare" },
      { type: "ul", items: [
        "Practise talking while you solve. Silence makes it hard for interviewers to give you credit.",
        "Revise fundamentals for your role: data structures, SQL, networking basics, statistics, or whatever the job description emphasises.",
        "Prepare two projects you can explain in depth: the problem, your choices, what went wrong and the result.",
        "If you get stuck, say what you have tried and what you would check next. That is a strong signal.",
      ] },
      { type: "tip", text: "Try the role-specific mock interview for your area. It asks realistic questions and shows what a stronger answer covers." },
    ],
  },
  {
    slug: "remote-interview-setup-and-proctoring",
    title: "Remote interviews and proctoring: what is monitored and why",
    summary: "Camera, screen share, friendly reminders and the optional face check, explained plainly so nothing surprises you on the day.",
    category: "Process",
    readMinutes: 4,
    updated: "2026-11-02",
    body: [
      { type: "p", text: "Remote interviews are convenient, but companies still want confidence that the right person is answering without outside help. Proctoring is how some platforms provide that. It is meant to protect honest candidates." },
      { type: "h2", text: "What may be checked" },
      { type: "ul", items: [
        "Camera on: confirms a person is present throughout.",
        "Screen sharing: shows the interview window is in use.",
        "Tab and window focus: switching away may prompt a reminder to come back.",
        "Face verification: for example, an optional check where you turn your face toward each corner of the screen to show you are live.",
        "A snapshot at the start: kept as a record of who took the interview.",
      ] },
      { type: "h2", text: "Your data and consent" },
      { type: "p", text: "You should always be shown what is recorded and why before you start, and you have to agree to it. If you are unsure how your data is stored or for how long, ask the recruiter before you begin." },
      { type: "h2", text: "A checklist before you begin" },
      { type: "ul", items: [
        "Close other tabs, chat apps and notification pop-ups.",
        "Charge your device or plug it in, and use a stable connection.",
        "Allow camera and microphone in your browser when asked.",
        "Keep your face well lit and centred, and stay in frame.",
        "Have water and a pen ready so you do not need to leave.",
      ] },
      { type: "tip", text: "If something technical goes wrong, tell the recruiter straight away with a short description. Genuine problems are usually handled fairly." },
    ],
  },
  {
    slug: "salary-negotiation-basics",
    title: "Talking about pay: research, ranges and negotiation",
    summary: "How to prepare a number, when to bring it up, and how to respond to an offer, including CTC and notice period.",
    category: "Offer & pay",
    readMinutes: 5,
    updated: "2026-11-02",
    body: [
      { type: "p", text: "Pay conversations feel awkward, but they are routine for recruiters. A little preparation makes them calm and fair." },
      { type: "h2", text: "Do your research" },
      { type: "ul", items: [
        "Look up ranges for the role, level, location and company size from several sources, and treat any single figure with care.",
        "Know your current pay and what you actually need. Decide your minimum, your target and your stretch.",
        "In India, know the difference between fixed pay, variable pay and benefits in the total CTC, and compare offers on in-hand pay and total value.",
      ] },
      { type: "h2", text: "When the question comes up" },
      { type: "p", text: "If asked early, you can give a researched range and say you are flexible for the right package: “Based on the role and my experience I am looking at ₹X to ₹Y, and I am open to discussing the full package.” If the posting already lists a range, anchor within it." },
      { type: "h2", text: "Responding to an offer" },
      { type: "ul", items: [
        "Say thank you and that you are excited. Ask for the offer in writing and a day or two to review it.",
        "Evaluate the whole package: base, variable, bonus, equity, leave, learning budget, work arrangement and growth.",
        "If you negotiate, give a reason tied to your skills, market data or competing interest, and propose a specific number.",
        "Ask about joining date and notice period buy-out at the same time, since those are negotiable too.",
      ] },
      { type: "h2", text: "What to avoid" },
      { type: "ul", items: [
        "Do not invent competing offers or inflate current pay. Both can be verified.",
        "Do not accept or reject on the spot if you are unsure. A brief pause is normal.",
        "Do not negotiate against yourself by lowering your figure before they respond.",
      ] },
      { type: "tip", text: "Practise saying your number out loud. It is much easier to say calmly in the interview once you have said it a few times." },
    ],
  },
  {
    slug: "questions-to-ask-and-follow-up",
    title: "Questions to ask the interviewer, and how to follow up",
    summary: "Close every interview well: thoughtful questions, a short thank-you, and what to do while you wait.",
    category: "Preparation",
    readMinutes: 4,
    updated: "2026-11-02",
    body: [
      { type: "p", text: "The end of an interview is your chance to confirm that the job suits you, and to leave a clear last impression. Have questions ready, and always follow up." },
      { type: "h2", text: "Questions worth asking" },
      { type: "ul", items: [
        "What would success look like in the first three to six months?",
        "What are the biggest challenges the team is facing right now?",
        "How do you give feedback, and how is performance reviewed?",
        "How does the team work together day to day, and how do you handle disagreements?",
        "What are the next steps, and when can I expect to hear back?",
      ] },
      { type: "p", text: "Avoid asking anything easily found on the website, and save detailed pay and leave questions for the right moment, usually with the recruiter." },
      { type: "h2", text: "The thank-you message" },
      { type: "p", text: "Send a short note within a day. Thank them for their time, mention one specific thing you discussed, and restate your interest in one line. Keep it to four or five sentences." },
      { type: "h2", text: "While you wait" },
      { type: "ul", items: [
        "If you were given a timeline, wait until it passes before checking in.",
        "A polite follow-up after a week or so is acceptable. Keep it brief and positive.",
        "Keep applying and interviewing elsewhere until you have a signed offer.",
        "If you are rejected, ask for feedback once, politely. Some companies share it.",
      ] },
      { type: "tip", text: "Write your questions in a notebook before the interview and tick them off as they are answered. It shows preparation." },
    ],
  },
  {
    slug: "common-interview-mistakes",
    title: "Ten common interview mistakes, and how to fix each one",
    summary: "The slips that cost candidates offers most often, with simple fixes you can practise in a mock interview.",
    category: "Preparation",
    readMinutes: 4,
    updated: "2026-11-02",
    body: [
      { type: "p", text: "Most interview mistakes are habits, and habits can be practised away. Here are the ones that come up again and again." },
      { type: "ul", items: [
        "Not researching the company. Spend twenty minutes on what they do, who they serve and recent news.",
        "Rambling. Lead with the point, add one example, finish with the result.",
        "Only saying 'we'. Make your own contribution explicit.",
        "No numbers. Add time saved, money, volume, percentage or team size wherever it is true.",
        "Hedging every sentence with 'I think' or 'maybe'. State what you did and why.",
        "Filler words. Replace 'like' and 'you know' with a short pause.",
        "Criticising a former employer. Describe what you are moving toward instead.",
        "Giving generic answers. Tie each story to this role's needs.",
        "Having no questions at the end. Prepare at least three.",
        "Skipping practice. Saying answers aloud is the single best preparation.",
      ] },
      { type: "tip", text: "Run a mock interview, then read the feedback tags: too short, no result, no numbers, hedging and filler words map directly to the list above." },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function formatArticleDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
