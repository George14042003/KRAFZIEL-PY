"""Built-in question bank for mock interviews. Used whenever the AI provider is unavailable, and as the
source of the category list either way. Each category lists questions from easiest to hardest; `tip` says what a
strong answer covers and is shown to the candidate as an optional hint."""

CATEGORIES: dict[str, dict] = {
    "general": {
        "label": "General / HR",
        "blurb": "The questions almost every first-round interview opens with.",
        "questions": [
            ("Tell me about yourself.", "Keep it to about a minute: where you are now, two or three relevant highlights, and why this role is next."),
            ("Why are you interested in this role and our company?", "Name something specific about the company or role, and link it to what you want to do next."),
            ("What are your biggest strengths?", "Pick two strengths that matter for the role and back each with a short real example."),
            ("What is a weakness you are actively working on?", "Choose a real, non-critical weakness, then describe the concrete steps you are taking and the progress so far."),
            ("Why are you leaving your current role, or why did you leave your last one?", "Stay positive and forward-looking. Focus on what you are moving toward, not on complaints."),
            ("What are your salary expectations?", "Give a researched range, tie it to the market and your experience, and show you are flexible on the full package."),
            ("Where do you see yourself in three to five years?", "Show ambition that fits the role, and make clear how this job helps you grow."),
            ("Why should we hire you over other candidates?", "Summarise your strongest match to the role's needs, with one proof point, and avoid comparing yourself to others."),
        ],
    },
    "behavioral": {
        "label": "Behavioral (STAR)",
        "blurb": "Past-experience questions. Practise the Situation, Task, Action, Result structure.",
        "questions": [
            ("Tell me about a time you worked well in a team.", "Name your specific contribution, not just what the team did. End with the outcome."),
            ("Describe a time you had to meet a tight deadline.", "Explain how you prioritised and what you did to deliver, then share the result."),
            ("Tell me about a time you made a mistake. What did you do?", "Own it plainly, explain the fix, and say what you now do differently."),
            ("Describe a time you disagreed with a colleague or manager.", "Show respect for the other view, how you reached a resolution, and what you learned."),
            ("Give an example of a time you took initiative.", "Explain what you noticed, what you chose to do without being asked, and the measurable impact."),
            ("Tell me about a time you handled a difficult customer or stakeholder.", "Describe how you listened, de-escalated, and found a workable outcome."),
            ("Describe a time you had to learn something quickly.", "Cover how you approached learning, how fast you became useful, and how you applied it."),
            ("Tell me about a time you failed to reach a goal.", "Be honest about the gap, the root cause, and the specific lesson you carried forward."),
            ("Describe a time you influenced a decision without having authority.", "Show how you gathered evidence, built support, and what changed as a result."),
        ],
    },
    "leadership": {
        "label": "Leadership & management",
        "blurb": "For team leads and people managers.",
        "questions": [
            ("How would you describe your leadership style?", "Describe your approach with one example of it working, and say how you adapt to different people."),
            ("Tell me about a time you motivated a struggling team member.", "Show you diagnosed the cause first, then what you changed and how their performance responded."),
            ("How do you prioritise when everything seems urgent?", "Explain your framework, how you communicate trade-offs, and give a real example."),
            ("Describe a time you had to deliver difficult feedback.", "Cover preparation, how you framed it kindly and clearly, and how the person responded."),
            ("Tell me about a time you led a team through a major change.", "Explain how you communicated the why, handled resistance, and measured success."),
            ("How do you build trust with a new team?", "Give concrete early actions: listening, small wins, being consistent and transparent."),
        ],
    },
    "software": {
        "label": "Software engineering",
        "blurb": "Technical and engineering-practice questions.",
        "questions": [
            ("Walk me through a project you are proud of and your technical contribution.", "State the problem, your design choices and why, and the outcome. Be precise about what you personally built."),
            ("How do you approach debugging a problem you have never seen before?", "Describe a systematic method: reproduce, isolate, form hypotheses, test, then add a regression test."),
            ("Explain the difference between a process and a thread.", "Cover memory sharing, isolation, cost of creation and context switching, with a simple example."),
            ("What makes code easy to maintain?", "Mention clear naming, small units, tests, consistent structure and documentation of the why."),
            ("How would you design a URL shortener?", "Clarify requirements, then cover ID generation, storage, read-heavy caching and scaling or abuse concerns."),
            ("Explain how you would make a slow API endpoint faster.", "Measure first, then look at queries and indexes, caching, payload size and work you can move off the request path."),
            ("What is the difference between SQL and NoSQL, and when would you choose each?", "Compare structure, consistency, scaling and query needs, and tie your choice to a use case."),
            ("How do you review a teammate's pull request?", "Mention correctness, tests, readability, risk, and giving kind, specific, actionable comments."),
            ("Describe how you would handle a production outage.", "Cover triage, communication, mitigation before root cause, then a blameless post-mortem."),
        ],
    },
    "data": {
        "label": "Data & analytics",
        "blurb": "Analysis, SQL, metrics and storytelling with data.",
        "questions": [
            ("Tell me about an analysis that changed a decision.", "State the question, how you analysed it, what you found, and the decision or impact that followed."),
            ("How do you make sure your data is accurate before you analyse it?", "Describe checks for duplicates, nulls, outliers and source reconciliation, and what you do when it is wrong."),
            ("Explain a join and the difference between inner and left joins.", "Use a small example and say what happens to unmatched rows in each."),
            ("How would you measure the success of a new feature?", "Define a goal metric, supporting and guardrail metrics, a baseline, and how you would test the change."),
            ("How do you explain a complex finding to a non-technical audience?", "Lead with the answer, use plain language and one clear visual, and tie it to a decision."),
            ("What is the difference between correlation and causation? Give an example.", "Define both and give an example, then say how you would test for causation, such as an experiment."),
            ("Walk me through how you would design an A/B test.", "Cover hypothesis, metric, sample size, randomisation, duration and how you will read the result."),
            ("A key metric dropped 15% overnight. What do you do?", "Check data issues first, then segment by time, product area and cohort, and communicate what you know while you investigate."),
        ],
    },
    "sales": {
        "label": "Sales & business development",
        "blurb": "Prospecting, discovery, objections and closing.",
        "questions": [
            ("Why do you want a career in sales?", "Show genuine interest in helping customers and being measured on results, and link it to your strengths."),
            ("Walk me through how you would qualify a new lead.", "Cover need, budget, authority and timeline, and how you decide where to spend effort."),
            ("Tell me about your biggest deal or sales win.", "Describe the situation, your approach, obstacles and the result with real numbers."),
            ("How do you handle the objection 'your price is too high'?", "Acknowledge it, explore what they are comparing to, anchor on value and outcomes, and offer options."),
            ("Describe a time you lost a deal. What did you learn?", "Be candid about the cause and what you changed in your process afterwards."),
            ("How do you build a pipeline when you are starting from nothing?", "Explain target definition, outreach channels, follow-up cadence and how you track conversion."),
            ("How would you sell this product to a sceptical customer?", "Ask questions to understand their concern before pitching, then connect features to their specific problem."),
            ("How do you stay motivated after repeated rejection?", "Show a healthy routine, learning from each no, and focus on activity you control."),
        ],
    },
    "marketing": {
        "label": "Marketing",
        "blurb": "Campaigns, channels, content and measurement.",
        "questions": [
            ("Tell me about a campaign you are proud of.", "Cover the goal, audience, your role, what you did and the measurable result."),
            ("How do you decide which marketing channels to invest in?", "Describe using audience, cost, past data and small tests before scaling."),
            ("How do you measure the success of a campaign?", "Link metrics to the goal, such as awareness, leads or revenue, and mention attribution limits."),
            ("Describe how you would launch a new product on a small budget.", "Define the audience and message, choose two or three focused channels, and plan a feedback loop."),
            ("Tell me about a campaign that did not work. What did you change?", "Explain how you spotted it, the diagnosis, and the change you made."),
            ("How do you write copy for different audiences?", "Show you research the audience, adapt tone and message, and test variants."),
            ("How do you work with sales and product teams?", "Describe shared goals, regular feedback on lead quality, and clear handoffs."),
        ],
    },
    "product": {
        "label": "Product & project management",
        "blurb": "Prioritisation, stakeholders, delivery and trade-offs.",
        "questions": [
            ("How do you prioritise a long list of requests?", "Describe a framework such as impact versus effort, how you use data, and how you explain no to stakeholders."),
            ("Tell me about a project you delivered end to end.", "Cover scope, plan, risks, how you kept people aligned, and the outcome."),
            ("How do you handle a stakeholder who keeps changing requirements?", "Show how you clarify the underlying goal, set change-control expectations and communicate the cost of changes."),
            ("Describe a time a project was going off track. What did you do?", "Explain how you spotted it, your recovery actions, and how you communicated with the team and sponsors."),
            ("How would you decide whether to build a new feature?", "Cover the user problem, evidence of demand, success metrics, cost and the cost of not doing it."),
            ("How do you gather and use user feedback?", "Mention interviews, usage data and support tickets, and how you turn them into decisions."),
            ("Tell me about a trade-off you had to make between speed and quality.", "Explain the options, how you decided, and the impact."),
            ("How do you measure whether a project was successful?", "Define success up front with measurable outcomes, then review it afterwards."),
        ],
    },
    "support": {
        "label": "Customer support & success",
        "blurb": "Empathy, communication and problem solving under pressure.",
        "questions": [
            ("Why do you want to work in customer support?", "Show that you enjoy solving problems for people and keeping calm under pressure."),
            ("How would you handle an angry customer?", "Listen without interrupting, acknowledge the feeling, take ownership, fix or escalate, and follow up."),
            ("Tell me about a time you went above and beyond for a customer.", "Describe what you noticed, what you did, and the customer's reaction or business result."),
            ("What would you do if you did not know the answer to a customer's question?", "Be honest, find the right answer or person, set expectations on timing and follow up."),
            ("How do you prioritise a busy queue of tickets?", "Explain urgency, impact and age, how you keep customers informed, and when you escalate."),
            ("How do you turn a bad customer experience into a good one?", "Cover apology, resolution, and a follow-up that shows you fixed the root cause."),
            ("How do you stay patient and positive after a tough day of calls?", "Show healthy routines, perspective and support from the team."),
        ],
    },
}

INTERVIEW_TYPES: dict[str, dict] = {
    "mixed": {"label": "Mixed round", "blurb": "A blend of general and behavioral questions, like a typical first interview.", "categories": ["general", "behavioral"]},
    "behavioral": {"label": "Behavioral", "blurb": "STAR-style questions about your past experience.", "categories": ["behavioral"]},
    "hr": {"label": "HR / culture fit", "blurb": "Motivation, strengths and expectations.", "categories": ["general"]},
    "technical": {"label": "Role-specific", "blurb": "Questions for your field. Pick a role area below.", "categories": []},
}

DIFFICULTIES = {
    "easy": "Warm-up",
    "medium": "Standard",
    "hard": "Challenging",
}
