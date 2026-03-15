// Seed data for initial courses
// Run with: npx tsx src/lib/seed/run-seed.ts

export interface SeedCourse {
  title: string;
  slug: string;
  description: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimated_hours: number;
  is_published: boolean;
  modules: SeedModule[];
}

export interface SeedModule {
  title: string;
  description: string;
  order_index: number;
  lessons: SeedLesson[];
}

export interface SeedLesson {
  title: string;
  slug: string;
  type: "article" | "video" | "quiz" | "practice";
  content: Record<string, unknown>;
  video_url: string | null;
  duration_minutes: number;
  order_index: number;
  is_published: boolean;
}

// ─── COURSE 1: Foundations of Competitive Debate ───────────────────────

const course1: SeedCourse = {
  title: "Foundations of Competitive Debate",
  slug: "foundations-of-competitive-debate",
  description:
    "Learn the essential skills of competitive debate — from understanding formats to building powerful arguments and delivering winning speeches.",
  category: "debate",
  difficulty: "beginner",
  estimated_hours: 8,
  is_published: true,
  modules: [
    // ── Module 1: What is Debate? ──
    {
      title: "What is Debate?",
      description: "Understand the world of competitive debate and its formats.",
      order_index: 0,
      lessons: [
        {
          title: "Introduction to Competitive Debate",
          slug: "introduction-to-competitive-debate",
          type: "article",
          video_url: null,
          duration_minutes: 10,
          order_index: 0,
          is_published: true,
          content: {
            markdown: `# Introduction to Competitive Debate

Have you ever watched a TED talk and thought, "I wish I could speak like that"? Or seen a courtroom drama where the lawyer's closing argument gave you chills? At the heart of all great public persuasion is **debate** — the art of constructing and defending ideas with clarity, logic, and passion.

## What is Competitive Debate?

Competitive debate is a structured activity where two sides argue **for** or **against** a given topic (called a "motion"). Unlike a casual argument with friends, competitive debate has:

- **Time limits** — each speaker gets a set amount of time
- **Rules** — specific formats dictate the order of speeches
- **Adjudicators** — judges evaluate arguments based on content, style, and strategy
- **Preparation time** — sometimes you get to prepare, sometimes you don't!

## Why Does Debate Matter?

Debate isn't just about winning trophies (though that's fun too!). Here's what you gain:

### 1. Critical Thinking
You learn to analyze issues from multiple perspectives. When you're assigned to argue a position you personally disagree with, you discover that most issues are more nuanced than they first appear.

### 2. Communication Skills
Debate forces you to express complex ideas clearly and persuasively. These skills transfer directly to school presentations, job interviews, and everyday conversations.

### 3. Research Ability
Good debaters are good researchers. You'll learn to find credible evidence, understand statistics, and cite sources effectively.

### 4. Confidence
Standing up and speaking in front of judges and opponents builds incredible confidence. Many debaters say it transformed their ability to speak up in any situation.

### 5. Global Awareness
Debate topics cover everything from education policy to climate change to technology ethics. You'll become better informed about the world around you.

## Debate in Vietnam

Vietnam has a growing and vibrant debate scene! From **Trường Teen** (the popular TV debate competition for high school students) to **WSDC** (World Schools Debating Championship) training camps, Vietnamese students are making their mark internationally.

Many universities in Vietnam now have active debate clubs, and national tournaments attract hundreds of teams each year. Whether you're in Hanoi, Ho Chi Minh City, or Da Nang, there's a debate community waiting for you.

## What You'll Learn in This Course

By the end of this course, you will be able to:

- Understand the major competitive debate formats
- Build strong, well-structured arguments
- Deliver effective rebuttals
- Structure a complete debate speech
- Practice with AI feedback to improve your skills

Let's get started! In the next lesson, we'll explore the three most popular debate formats you'll encounter.`,
          },
        },
        {
          title: "Key Debate Formats: BP, WSDC, and Trường Teen",
          slug: "key-debate-formats",
          type: "article",
          video_url: null,
          duration_minutes: 12,
          order_index: 1,
          is_published: true,
          content: {
            markdown: `# Key Debate Formats: BP, WSDC, and Trường Teen

Not all debates look the same. Different competitions use different **formats** — each with its own rules, team sizes, and strategies. Let's explore the three formats you're most likely to encounter.

## 1. British Parliamentary (BP)

BP is the most widely used format in university-level debating worldwide, and it's increasingly popular at the high school level too.

### How it works:
- **4 teams** of 2 speakers each
- Teams are divided into **Opening Government**, **Opening Opposition**, **Closing Government**, and **Closing Opposition**
- Each speaker gets **7 minutes**
- Motions are announced **15 minutes** before the debate (impromptu prep!)

### Key strategy:
- Opening teams must define the debate and present core arguments
- Closing teams must add **new** arguments (called an "extension") while building on what Opening said
- You're competing against all three other teams, not just the opposition

### Why students love it:
BP is fast-paced and requires quick thinking. With only 15 minutes of prep and 4 teams in the room, every round feels exciting.

## 2. World Schools Debating Championship (WSDC)

WSDC is the format used at the World Schools Debating Championship — the biggest international tournament for high school debaters.

### How it works:
- **2 teams** of 3-5 members (3 speakers per round)
- **8-minute** speeches for each speaker
- **4-minute** reply speeches by the 1st or 2nd speaker
- Motions can be **prepared** (announced days in advance) or **impromptu** (1 hour prep)

### The speech order:
1. First Proposition (8 min)
2. First Opposition (8 min)
3. Second Proposition (8 min)
4. Second Opposition (8 min)
5. Third Proposition (8 min)
6. Third Opposition (8 min)
7. Opposition Reply (4 min)
8. Proposition Reply (4 min)

### Key strategy:
- Each speaker has a defined role: 1st speakers set up, 2nd speakers clash and rebuild, 3rd speakers summarize
- Reply speeches are crucial — they're the last word and must weigh the debate
- WSDC values **substance** (content), **style** (delivery), and **strategy** (structure)

## 3. Trường Teen Format

**Trường Teen** is Vietnam's own beloved debate format, popularized by the TV show of the same name. It's designed to be engaging and accessible for Vietnamese high school students.

### How it works:
- **2 teams** argue for and against a motion
- Multiple rounds including opening statements, rebuttals, and closing
- Often includes audience interaction and judge Q&A
- Time limits vary but are generally shorter than international formats

### Key features:
- Motions are often about Vietnamese society, education, and culture
- Speaking in Vietnamese is common, though English rounds exist
- The format emphasizes **clear communication** and **audience engagement**
- It's more flexible and entertainment-friendly than BP or WSDC

### Why it matters:
Trường Teen has introduced thousands of Vietnamese students to debate. Many go on to compete in WSDC and BP formats at the university level.

## Which Format Should You Learn First?

For beginners, we recommend starting with **WSDC-style** practice:
- Two clear sides (proposition vs. opposition)
- Defined speaker roles
- Both prepared and impromptu rounds
- Clear judging criteria

The good news? **The core skills are the same across all formats**: building arguments, making rebuttals, and speaking persuasively. Master these, and you can adapt to any format.

In the next lesson, we'll test your knowledge of these formats with a quick quiz!`,
          },
        },
        {
          title: "Format Knowledge Check",
          slug: "format-knowledge-check",
          type: "quiz",
          video_url: null,
          duration_minutes: 5,
          order_index: 2,
          is_published: true,
          content: {
            questions: [
              {
                question: "How many teams compete in a British Parliamentary (BP) debate?",
                options: ["2 teams", "3 teams", "4 teams", "5 teams"],
                correct_answer: "4 teams",
                explanation: "BP has 4 teams: Opening Government, Opening Opposition, Closing Government, and Closing Opposition, each with 2 speakers.",
              },
              {
                question: "In WSDC format, how long is a standard speech?",
                options: ["5 minutes", "7 minutes", "8 minutes", "10 minutes"],
                correct_answer: "8 minutes",
                explanation: "WSDC speeches are 8 minutes long, with reply speeches being 4 minutes.",
              },
              {
                question: "What is an 'extension' in BP debate?",
                options: [
                  "Extra time given to a speaker",
                  "A new argument added by the closing team",
                  "A break between rounds",
                  "A question from the audience",
                ],
                correct_answer: "A new argument added by the closing team",
                explanation: "In BP, closing teams must present an 'extension' — a genuinely new argument that goes beyond what the opening teams said.",
              },
              {
                question: "Which debate format is most associated with Vietnamese TV?",
                options: ["BP", "WSDC", "Trường Teen", "Lincoln-Douglas"],
                correct_answer: "Trường Teen",
                explanation: "Trường Teen is Vietnam's popular TV debate competition for high school students.",
              },
              {
                question: "In WSDC, what are the three criteria judges use to evaluate speakers?",
                options: [
                  "Speed, volume, and humor",
                  "Substance, style, and strategy",
                  "Content, grammar, and vocabulary",
                  "Logic, emotion, and evidence",
                ],
                correct_answer: "Substance, style, and strategy",
                explanation: "WSDC judges evaluate speakers on substance (the content of arguments), style (delivery and manner), and strategy (structure and response to opponents).",
              },
            ],
          },
        },
        {
          title: "Your First Debate",
          slug: "your-first-debate",
          type: "practice",
          video_url: null,
          duration_minutes: 15,
          order_index: 3,
          is_published: true,
          content: {
            practice_config: {
              topic_title: "Social media does more harm than good for teenagers",
              topic_category: "Technology & Social Media",
              suggested_mode: "quick",
              suggested_difficulty: "easy",
              suggested_side: "random",
              description: "Try your first debate! Pick a side and make your argument about social media's impact on teenagers. Don't worry about being perfect — this is about getting comfortable speaking.",
            },
          },
        },
      ],
    },
    // ── Module 2: Building Arguments ──
    {
      title: "Building Arguments",
      description: "Learn to construct compelling, well-structured arguments.",
      order_index: 1,
      lessons: [
        {
          title: "Claim, Warrant, Impact: The Foundation of Every Argument",
          slug: "claim-warrant-impact",
          type: "article",
          video_url: null,
          duration_minutes: 12,
          order_index: 0,
          is_published: true,
          content: {
            markdown: `# Claim, Warrant, Impact: The Foundation of Every Argument

Every great debate argument follows a simple three-part structure: **Claim**, **Warrant**, and **Impact**. Master this framework, and you'll never struggle to build a convincing point again.

## What is a Claim?

A **claim** is your main point — the thing you're trying to prove. It's a clear, specific statement that takes a position.

**Good claims:**
- "Banning homework would improve students' mental health"
- "Universal basic income reduces poverty more effectively than targeted welfare"
- "Social media platforms should be required to verify users' ages"

**Bad claims (too vague):**
- "Homework is bad" (Why? For whom?)
- "Money helps people" (Too obvious, not debatable)
- "Social media is a problem" (What specific problem?)

### Tips for strong claims:
- Be **specific** — narrow your claim to something you can actually prove
- Be **debatable** — if everyone agrees, it's not an argument
- Be **relevant** — your claim should directly support your team's case

## What is a Warrant?

A **warrant** is your reasoning — the logical explanation for **why** your claim is true. This is where most beginners struggle. They state their claim but forget to explain the logic behind it.

Think of a warrant as answering the question: **"Why should I believe your claim?"**

### Example:
- **Claim:** "Banning homework would improve students' mental health"
- **Warrant:** "Students currently spend 2-3 hours on homework after a full school day, leaving no time for exercise, hobbies, or rest. This creates chronic stress and sleep deprivation, which are leading causes of anxiety and depression among teenagers."

### Types of warrants:
1. **Logical reasoning** — using cause-and-effect logic
2. **Evidence-based** — citing studies, statistics, or expert opinions
3. **Analogical** — comparing to a similar situation where the outcome is known
4. **Principled** — appealing to fairness, rights, or moral values

## What is an Impact?

The **impact** explains **why your argument matters**. Even if your claim is true and your warrant is logical, the judge needs to know: "So what? Why should we care?"

### Example (continuing from above):
- **Claim:** "Banning homework would improve students' mental health"
- **Warrant:** "Students spend 2-3 hours on homework after school, causing chronic stress and sleep deprivation..."
- **Impact:** "This matters because mental health problems in teenagers have reached crisis levels in Vietnam, with studies showing a 40% increase in student anxiety over the past decade. By removing homework, we can address one of the most significant controllable factors in student wellbeing, leading to healthier, more engaged learners."

### Making impacts powerful:
- **Quantify** when possible (numbers make impacts concrete)
- **Show scope** — how many people are affected?
- **Connect to values** — health, education, fairness, freedom
- **Compare** — is this impact bigger than what the other team offers?

## Putting It All Together

Here's a complete argument using CWI:

> **Claim:** Schools should teach financial literacy as a required subject.
>
> **Warrant:** Currently, most students graduate without understanding basic concepts like budgeting, taxes, or compound interest. This leaves them vulnerable to debt, poor financial decisions, and economic hardship. Countries like Australia that introduced financial literacy curricula saw a measurable improvement in young adults' savings rates and reduced personal debt.
>
> **Impact:** This matters because financial stress is the number one cause of anxiety among young Vietnamese adults entering the workforce. Teaching financial literacy in school would equip millions of students with skills that directly affect their quality of life for decades to come.

## Common Mistakes to Avoid

1. **Assertion without warrant** — saying "homework is bad because it's bad"
2. **Warrant without impact** — explaining the logic but not why it matters
3. **Generic impacts** — "this will make society better" (be specific!)
4. **Forgetting to link back** — make sure your impact connects to your team's overall case

In the next lesson, we'll watch how skilled debaters structure their arguments in real debates.`,
          },
        },
        {
          title: "Watch: How to Structure an Argument",
          slug: "watch-structure-argument",
          type: "video",
          video_url: "https://www.youtube.com/watch?v=placeholder-argument-structure",
          duration_minutes: 8,
          order_index: 1,
          is_published: true,
          content: {
            description: "Watch this video to see how experienced debaters structure their arguments using the Claim-Warrant-Impact framework in real competitive rounds.",
            notes: "Pay attention to how each speaker:\n1. States their claim clearly at the beginning\n2. Provides detailed reasoning (warrant)\n3. Explains why the argument matters (impact)\n4. Links back to their team's overall case",
          },
        },
        {
          title: "Using Evidence Effectively",
          slug: "using-evidence-effectively",
          type: "article",
          video_url: null,
          duration_minutes: 10,
          order_index: 2,
          is_published: true,
          content: {
            markdown: `# Using Evidence Effectively

Great debaters don't just make logical arguments — they back them up with **evidence**. But not all evidence is created equal. Let's learn how to find, evaluate, and present evidence that strengthens your case.

## Types of Evidence

### 1. Statistics
Numbers are powerful because they're specific and hard to argue against.

**Weak:** "Many students are stressed about exams."
**Strong:** "According to a 2023 UNICEF report, 73% of Vietnamese secondary students report feeling 'very stressed' during exam season."

### 2. Expert Opinions
Citing recognized authorities adds credibility to your arguments.

**Example:** "As Nobel Prize-winning economist Joseph Stiglitz argues, universal basic income could reduce inequality without the bureaucratic overhead of means-tested welfare programs."

### 3. Real-World Examples
Concrete examples from history or current events make abstract arguments tangible.

**Example:** "When Finland eliminated standardized testing for students under 16, their educational outcomes actually improved, with Finland consistently ranking in the top 5 globally in PISA scores."

### 4. Analogies
Comparing your situation to a well-known case can be powerful, especially when direct evidence is limited.

**Example:** "Just as seatbelt laws were initially criticized as restricting freedom but ultimately saved millions of lives, regulations on social media will be seen as necessary protections in hindsight."

## How to Present Evidence

### The SEXI Method
When presenting evidence in a debate speech, use the **SEXI** method:

1. **S**tate your claim
2. **E**xplain the evidence
3. **X** — e**X**plain why the evidence proves your claim
4. **I**mpact — explain why this matters

### Example:
> "We believe that raising the minimum wage reduces poverty (S). A 2022 study by the Vietnamese Ministry of Labor found that provinces that increased minimum wages by 15% saw poverty rates drop by 8% within two years (E). This shows a direct, measurable link between wage increases and poverty reduction (X). This is significant because it means a simple policy change could lift hundreds of thousands of Vietnamese families out of poverty (I)."

## Common Evidence Mistakes

### 1. Making Up Statistics
Never invent numbers. Judges can often tell when statistics sound fabricated. If you don't have exact numbers, say "studies suggest" or "evidence indicates" rather than making up a specific percentage.

### 2. Cherry-Picking
Don't only present evidence that supports your side while ignoring obvious counter-evidence. Good debaters acknowledge opposing evidence and explain why their evidence is more relevant or reliable.

### 3. Outdated Evidence
A study from 1995 about internet usage isn't relevant to today's debate about social media. Always try to use recent evidence.

### 4. Irrelevant Evidence
Your evidence must directly support your specific claim. A statistic about education in Europe might not apply to the Vietnamese context.

## Building an Evidence Bank

Top debaters maintain a mental library of evidence they can use across multiple topics. Start building yours:

- **Follow the news** — read BBC, VnExpress International, or The Economist regularly
- **Know your numbers** — memorize key statistics about Vietnam (population, GDP, literacy rate, internet usage)
- **Learn case studies** — know 5-10 examples of policy changes from different countries
- **Understand trends** — be aware of global trends in technology, education, environment, and economics

## Evidence in Different Formats

- **In prepared debates** (WSDC prepared motions): You have time to research. Use specific, cited evidence.
- **In impromptu debates** (BP, WSDC impromptu): You can't research, so use general knowledge, logical reasoning, and well-known examples.
- **In practice** (like DebateLab): Focus on learning to integrate evidence smoothly into your speech flow.

Remember: evidence supports your argument, but it doesn't replace it. Always combine evidence with clear reasoning (warrant) and meaningful impact.`,
          },
        },
        {
          title: "Argument Building Quiz",
          slug: "argument-building-quiz",
          type: "quiz",
          video_url: null,
          duration_minutes: 5,
          order_index: 3,
          is_published: true,
          content: {
            questions: [
              {
                question: "In the CWI framework, what does the 'Warrant' do?",
                options: [
                  "States the main point",
                  "Explains why the claim is true",
                  "Shows why the argument matters",
                  "Summarizes the debate",
                ],
                correct_answer: "Explains why the claim is true",
                explanation: "The warrant provides the logical reasoning or evidence that supports your claim. It answers 'Why should I believe this?'",
              },
              {
                question: "Which of these is the strongest claim?",
                options: [
                  "Education is important",
                  "Schools should be better",
                  "Replacing exams with project-based assessment improves critical thinking",
                  "Exams are bad for students",
                ],
                correct_answer: "Replacing exams with project-based assessment improves critical thinking",
                explanation: "Strong claims are specific, debatable, and focused. This option specifies what should change and what the expected outcome is.",
              },
              {
                question: "What does the SEXI method stand for?",
                options: [
                  "State, Evidence, eXplain, Impact",
                  "Summary, Example, eXpand, Introduce",
                  "Start, Engage, eXpress, Inspire",
                  "Setup, Evaluate, eXamine, Implement",
                ],
                correct_answer: "State, Evidence, eXplain, Impact",
                explanation: "SEXI is a framework for presenting evidence: State your claim, present Evidence, eXplain why it proves your claim, and show the Impact.",
              },
              {
                question: "Why is cherry-picking evidence a bad practice?",
                options: [
                  "It takes too much time",
                  "Judges respect debaters who acknowledge opposing evidence",
                  "It makes your speech too long",
                  "It's against the rules",
                ],
                correct_answer: "Judges respect debaters who acknowledge opposing evidence",
                explanation: "Cherry-picking undermines your credibility. Good debaters acknowledge counter-evidence and explain why their evidence is more compelling.",
              },
              {
                question: "In an impromptu debate with no preparation time, what type of evidence is most appropriate?",
                options: [
                  "Specific cited statistics",
                  "Made-up numbers that sound realistic",
                  "General knowledge, logical reasoning, and well-known examples",
                  "No evidence at all — just opinions",
                ],
                correct_answer: "General knowledge, logical reasoning, and well-known examples",
                explanation: "In impromptu debates, you can't research, so rely on your general knowledge, clear logical reasoning, and well-known real-world examples.",
              },
            ],
          },
        },
        {
          title: "Practice: Build Your Argument",
          slug: "practice-build-your-argument",
          type: "practice",
          video_url: null,
          duration_minutes: 15,
          order_index: 4,
          is_published: true,
          content: {
            practice_config: {
              topic_title: "Schools should replace letter grades with written feedback",
              topic_category: "Education & School Life",
              suggested_mode: "quick",
              suggested_difficulty: "easy",
              suggested_side: "proposition",
              description: "Practice building a strong CWI argument. Focus on: (1) stating a clear claim, (2) providing a strong warrant with reasoning and evidence, (3) explaining the impact. Try to use the SEXI method when presenting your evidence.",
            },
          },
        },
      ],
    },
    // ── Module 3: The Art of Rebuttal ──
    {
      title: "The Art of Rebuttal",
      description: "Learn to respond to and dismantle opposing arguments.",
      order_index: 2,
      lessons: [
        {
          title: "What Makes a Strong Rebuttal?",
          slug: "what-makes-a-strong-rebuttal",
          type: "article",
          video_url: null,
          duration_minutes: 10,
          order_index: 0,
          is_published: true,
          content: {
            markdown: `# What Makes a Strong Rebuttal?

If building arguments is the sword of debate, **rebuttal** is the shield. No matter how brilliant your arguments are, you'll lose if you can't respond to what the other side says. Let's learn the art of effective rebuttal.

## What is a Rebuttal?

A rebuttal is your response to your opponent's argument. It's not just disagreeing — it's systematically showing **why** their argument is wrong, weak, or less important than yours.

## The 4 Types of Rebuttal

### 1. Factual Rebuttal
Challenge the **facts** or evidence your opponent uses.

> **Opponent says:** "Finland has no homework and they rank #1 in education."
> **Your rebuttal:** "Actually, Finland does assign homework — just less of it. And their high ranking is attributed to teacher quality and early childhood education, not the absence of homework."

### 2. Logical Rebuttal
Show that your opponent's **reasoning** is flawed — even if their facts are correct.

> **Opponent says:** "Country X banned plastic bags and pollution decreased, so banning plastic bags will work everywhere."
> **Your rebuttal:** "While it's true that Country X saw results, their success depended on strong enforcement and available alternatives. In countries without these conditions, bans have actually increased the use of thicker, more harmful plastics."

### 3. Impact Rebuttal
Accept their point but argue that the **impact** is small or outweighed by other factors.

> **Opponent says:** "Uniforms restrict students' self-expression."
> **Your rebuttal:** "Even if uniforms somewhat limit fashion choices, students express themselves in countless other ways — through art, music, writing, and social media. The impact on self-expression is minimal compared to the benefits of reduced bullying and economic equality that uniforms provide."

### 4. Counter-Example Rebuttal
Provide an example that **contradicts** their argument.

> **Opponent says:** "Raising the minimum wage always leads to job losses."
> **Your rebuttal:** "When Seattle raised its minimum wage to $15 in 2015, studies by the University of Washington found that while some hours were reduced, workers' overall income increased, and the unemployment rate actually fell. This directly contradicts the claim that wage increases always cause job losses."

## The Rebuttal Framework: AREO

Use the **AREO** method to structure rebuttals:

1. **A**cknowledge — briefly state what your opponent said
2. **R**espond — explain why it's wrong or flawed
3. **E**vidence — provide your own evidence or reasoning
4. **O**utweigh — explain why your side's argument is more important

### Example:
> "The opposition argues that social media helps students stay connected (A). However, research from the Vietnamese Institute of Psychology shows that heavy social media use actually increases feelings of loneliness and isolation (R). A 2023 study found that students who limited social media to 30 minutes daily reported 25% higher life satisfaction (E). So while social media offers some connection, the mental health costs far outweigh these benefits (O)."

## Common Rebuttal Mistakes

1. **Straw man** — misrepresenting what your opponent said to make it easier to attack
2. **Ad hominem** — attacking the person instead of the argument
3. **Ignoring strong points** — only addressing the weakest argument and ignoring the rest
4. **Simply disagreeing** — saying "that's wrong" without explaining why
5. **Being rude** — good debaters are firm but respectful

## Tips for Better Rebuttals

- **Listen carefully** during your opponent's speech and take notes
- **Prioritize** — respond to their strongest argument first
- **Be specific** — don't just say "their evidence is bad"; explain exactly what's wrong with it
- **Connect to your case** — show how your rebuttal strengthens your overall position
- **Practice flowing** — "flowing" means taking organized notes during a debate

Rebuttal is a skill that improves dramatically with practice. In the next lesson, we'll look at logical fallacies — weaknesses in reasoning that you can learn to spot and exploit.`,
          },
        },
        {
          title: "Common Logical Fallacies to Spot and Exploit",
          slug: "common-logical-fallacies",
          type: "article",
          video_url: null,
          duration_minutes: 12,
          order_index: 1,
          is_published: true,
          content: {
            markdown: `# Common Logical Fallacies to Spot and Exploit

A **logical fallacy** is an error in reasoning that makes an argument invalid. Learning to identify these in your opponent's speeches — and avoiding them in your own — is a superpower in debate.

## 1. Slippery Slope

**What it is:** Arguing that one small step will inevitably lead to extreme consequences, without proving the connection.

**Example:** "If we allow students to use AI for research, next they'll use it to write all their essays, then they'll stop thinking altogether, and eventually human intelligence will decline."

**How to call it out:** "The opposition presents a slippery slope fallacy. There's no evidence that using AI for research will lead to these extreme outcomes. Many tools throughout history — calculators, the internet, spell-check — were feared for the same reasons, yet education has continued to improve."

## 2. False Dilemma

**What it is:** Presenting only two options when more exist.

**Example:** "Either we ban all social media for teens, or we accept that cyberbullying will destroy our children's lives."

**How to call it out:** "This is a false dilemma. There are many options between a total ban and doing nothing: age verification, content moderation, digital literacy education, and parental controls."

## 3. Appeal to Emotion

**What it is:** Using emotional manipulation instead of logical reasoning.

**Example:** "Think of the poor children crying themselves to sleep because of homework! How can you support such cruelty?"

**How to call it out:** "While we care deeply about children's wellbeing, the opposition is appealing to emotion rather than providing evidence. The question isn't whether homework sometimes causes stress, but whether the educational benefits outweigh the costs."

## 4. Hasty Generalization

**What it is:** Drawing a broad conclusion from limited examples.

**Example:** "My cousin dropped out of school and became a millionaire. This proves that formal education is unnecessary."

**How to call it out:** "One success story doesn't represent the overall picture. Statistics show that on average, each additional year of education increases lifetime earnings by 10%. A single example cannot disprove a well-established trend."

## 5. Ad Hominem

**What it is:** Attacking the person making the argument rather than the argument itself.

**Example:** "The first speaker has never competed in a national tournament, so their arguments about debate formats can't be taken seriously."

**How to call it out:** "The credibility of an argument depends on its logic and evidence, not on who delivers it. We should evaluate the argument on its merits."

## 6. Appeal to Authority

**What it is:** Claiming something is true just because an authority figure said it, without further evidence.

**Example:** "Einstein said imagination is more important than knowledge, so schools should stop teaching facts."

**How to call it out:** "While we respect Einstein's contributions to physics, his opinion on education policy isn't evidence. We need educational research, not quotes from scientists speaking outside their expertise."

## 7. Circular Reasoning

**What it is:** Using your conclusion as your evidence.

**Example:** "Social media is harmful because it's bad for people."

**How to call it out:** "The opposition is using circular reasoning — they're essentially saying 'it's bad because it's bad.' They need to explain the specific mechanism of harm with evidence."

## 8. Red Herring

**What it is:** Introducing an irrelevant topic to distract from the real argument.

**Example:** (In a debate about school uniforms) "But what about the quality of school cafeteria food? That's the real problem affecting students."

**How to call it out:** "The opposition has introduced a red herring. While cafeteria quality is important, it's entirely irrelevant to whether school uniforms should be mandatory. Let's return to the actual motion."

## Using Fallacy Identification in Debate

When you spot a fallacy:
1. **Name it** (judges appreciate technical knowledge)
2. **Explain why** it's a fallacy in simple terms
3. **Show what's missing** from their argument
4. **Rebuild your case** — don't just tear down; build up

**Pro tip:** Don't accuse every argument of being a fallacy. Reserve this tool for clear, obvious cases. Overusing it makes you look like you're avoiding engagement with the actual arguments.`,
          },
        },
        {
          title: "Watch: Rebuttal Techniques in Action",
          slug: "watch-rebuttal-techniques",
          type: "video",
          video_url: "https://www.youtube.com/watch?v=placeholder-rebuttal-techniques",
          duration_minutes: 10,
          order_index: 2,
          is_published: true,
          content: {
            description: "Watch skilled debaters demonstrate effective rebuttal techniques in competitive rounds. Notice how they acknowledge, respond, provide evidence, and outweigh.",
            notes: "Watch for:\n1. How speakers take notes during opponent speeches\n2. The AREO structure in practice\n3. How they balance rebuttal with their own arguments\n4. Their tone — firm but respectful",
          },
        },
        {
          title: "Practice: Defend Your Position",
          slug: "practice-defend-your-position",
          type: "practice",
          video_url: null,
          duration_minutes: 20,
          order_index: 3,
          is_published: true,
          content: {
            practice_config: {
              topic_title: "Standardized testing should be abolished in schools",
              topic_category: "Education & School Life",
              suggested_mode: "full",
              suggested_difficulty: "easy",
              suggested_side: "random",
              description: "Practice your rebuttal skills in a full round debate! The AI opponent will present arguments against your position. Focus on using the AREO framework: Acknowledge what the AI says, Respond with your counter-reasoning, provide Evidence, and Outweigh.",
            },
          },
        },
      ],
    },
    // ── Module 4: Putting It All Together ──
    {
      title: "Putting It All Together",
      description: "Combine everything into a polished debate performance.",
      order_index: 3,
      lessons: [
        {
          title: "Speech Structure: Opening, Body, Closing",
          slug: "speech-structure",
          type: "article",
          video_url: null,
          duration_minutes: 12,
          order_index: 0,
          is_published: true,
          content: {
            markdown: `# Speech Structure: Opening, Body, Closing

You've learned to build arguments and make rebuttals. Now let's put it all together into a well-structured speech that flows naturally and convinces judges.

## The Three Parts of a Debate Speech

Every debate speech — whether it's 3 minutes or 8 minutes — has three parts:

### 1. Opening (10-15% of your time)

Your opening should accomplish three things:
- **Hook the audience** — start with something engaging
- **State your team's position** — make your stance crystal clear
- **Preview your arguments** — tell the judges what you'll prove

**Example opening:**
> "Madame Chair, when was the last time a standardized test measured creativity? Or resilience? Or the ability to work in a team? Today, the proposition will show that standardized testing fails to measure what truly matters, wastes valuable learning time, and creates inequality. We'll prove that there are better alternatives."

**What makes a good hook:**
- A rhetorical question
- A surprising statistic
- A brief real-world example
- A vivid scenario

**What to avoid:**
- "Today we will define the motion as..." (boring!)
- Starting with "Um, so, like..." (practice your first sentence until it's automatic)
- Jokes that might fall flat (save humor for when you're confident)

### 2. Body (75-80% of your time)

The body contains your arguments. For most speeches, aim for **2-3 strong arguments** rather than 5-6 weak ones. Quality beats quantity.

**Structure each argument using CWI:**
1. Claim — state your point
2. Warrant — explain the reasoning and evidence
3. Impact — explain why it matters

**Signpost between arguments:**
- "My first argument is..."
- "Moving to my second point..."
- "Finally, and most importantly..."

Signposting helps judges follow your speech. Without it, your arguments blur together.

**For rebuttal speeches (2nd and 3rd speakers):**
Spend the first 1-2 minutes addressing the opposing team's arguments before presenting your own material.

### 3. Closing (10-15% of your time)

Your closing is your last chance to persuade. Make it count.

**A strong closing should:**
- Summarize your key arguments (briefly — don't just repeat everything)
- Restate why your side wins the debate
- End with a powerful final line

**Example closing:**
> "Today we've shown three things: standardized tests fail to measure real-world skills, they consume hundreds of hours that could be spent actually learning, and they disproportionately disadvantage students from lower-income families. The opposition has offered no viable defense of a system that even its creators admit is deeply flawed. For the sake of every student who deserves to be judged on their true potential, not their test-taking ability, we are proud to propose."

## Time Management

One of the biggest mistakes new debaters make is running out of time or having too much time left.

**Tips:**
- **Practice with a timer** — always (DebateLab's timer helps!)
- **Know your pace** — most people speak about 130-150 words per minute
- **Have a priority order** — if you're running short on time, know which argument to cut
- **Watch the clock** — glance at the timer regularly, not just at the end

## Bringing It All Together

Here's a template for a complete 5-minute debate speech:

| Section | Time | Content |
|---------|------|---------|
| Opening | 0:00-0:40 | Hook, team position, argument preview |
| Argument 1 | 0:40-2:00 | Claim, warrant, impact |
| Argument 2 | 2:00-3:20 | Claim, warrant, impact |
| Argument 3 | 3:20-4:20 | Claim, warrant, impact |
| Closing | 4:20-5:00 | Summary, final impact, strong ending |

## Practice Makes Perfect

The difference between good debaters and great debaters isn't knowledge — it's practice. Every time you give a speech, you get a little better at:
- Managing your time
- Transitioning between points
- Reading the room
- Adapting in real-time

In the next lesson, we'll explore advanced persuasion techniques that can take your speeches from good to unforgettable.`,
          },
        },
        {
          title: "Persuasion Techniques and Rhetoric",
          slug: "persuasion-techniques",
          type: "article",
          video_url: null,
          duration_minutes: 10,
          order_index: 1,
          is_published: true,
          content: {
            markdown: `# Persuasion Techniques and Rhetoric

Aristotle identified three modes of persuasion over 2,000 years ago, and they're still the foundation of every great speech today: **Ethos**, **Pathos**, and **Logos**.

## Ethos: Credibility

**Ethos** is about establishing trust and authority. Judges are more likely to believe you if you seem knowledgeable and fair.

### How to build ethos:
- **Show preparation** — reference specific evidence and examples
- **Acknowledge the other side** — "We understand why the opposition believes X, but..."
- **Be confident but not arrogant** — speak with conviction without dismissing opponents
- **Use precise language** — avoid vague words like "stuff" or "things"

### Example:
> "Research from the World Health Organization, published just last month, confirms what education experts have argued for years..."

## Pathos: Emotion

**Pathos** appeals to the audience's feelings. While debate values logic, strategic emotional appeal can be extremely powerful.

### How to use pathos ethically:
- **Tell a story** — "Imagine a student in rural Vietnam who walks 5km to school..."
- **Use vivid language** — paint a picture with words
- **Connect to shared values** — family, fairness, future generations
- **Be genuine** — fake emotion is obvious and damages credibility

### When to use pathos:
- **Opening hooks** — grab attention with a compelling scenario
- **Impact analysis** — help judges feel why your argument matters
- **Closing statements** — end on an emotional high note

### Warning:
Pathos should **supplement** logical arguments, not replace them. A speech that's all emotion and no logic will lose every time.

## Logos: Logic

**Logos** is the backbone of competitive debate. Logical reasoning is what separates strong arguments from unsupported claims.

### Techniques for strong logos:
- **Cause and effect** — "If X happens, Y will follow because..."
- **Comparative analysis** — "Country A tried this policy and succeeded, while Country B didn't, and failed"
- **Cost-benefit analysis** — "The benefits (A, B, C) clearly outweigh the costs (D, E)"
- **Principled reasoning** — "Based on the principle of equal opportunity..."

## Advanced Rhetorical Devices

### 1. The Rule of Three
People remember things in threes. Structure your speech with three main points, use three examples, or use three adjectives.

> "This policy is ineffective, expensive, and unfair."

### 2. Rhetorical Questions
Questions that don't need an answer but make the audience think.

> "Can we really call ourselves a modern society if we deny basic education to millions?"

### 3. Repetition (Anaphora)
Repeating a phrase for emphasis.

> "We need change in our schools. We need change in our policies. We need change in how we value our students."

### 4. Contrast (Antithesis)
Placing opposite ideas next to each other for emphasis.

> "The opposition offers a world where test scores define a student's worth. We offer a world where every student's potential is recognized and nurtured."

### 5. Inclusive Language
Using "we" and "us" creates a sense of shared purpose.

> "Together, we can build an education system that serves every student, not just those who are good at taking tests."

## Balancing All Three

The best speeches combine all three modes of persuasion:

1. **Open with ethos** — establish credibility through preparation and acknowledgment
2. **Build with logos** — present logical, well-evidenced arguments
3. **Close with pathos** — end with emotional impact that resonates

Remember: debate is ultimately about **persuasion**. The team that best convinces the judges — through credibility, logic, and strategic emotion — wins the round.

Now it's time to put everything together in your final practice round!`,
          },
        },
        {
          title: "Final Practice: Full Debate",
          slug: "final-practice-full-debate",
          type: "practice",
          video_url: null,
          duration_minutes: 25,
          order_index: 2,
          is_published: true,
          content: {
            practice_config: {
              topic_title: "The government should implement a four-day work week",
              topic_category: "Vietnam-Specific Issues",
              suggested_mode: "full",
              suggested_difficulty: "medium",
              suggested_side: "random",
              description: "Put everything together in a full debate! Apply all the skills you've learned: CWI arguments, AREO rebuttals, proper speech structure (opening, body, closing), and persuasion techniques (ethos, pathos, logos). This is your graduation debate!",
            },
          },
        },
        {
          title: "Course Final Assessment",
          slug: "course-final-assessment",
          type: "quiz",
          video_url: null,
          duration_minutes: 10,
          order_index: 3,
          is_published: true,
          content: {
            questions: [
              {
                question: "What are the three parts of the CWI framework?",
                options: [
                  "Claim, Warrant, Impact",
                  "Context, Warrant, Information",
                  "Claim, Witness, Impact",
                  "Conclusion, Warrant, Introduction",
                ],
                correct_answer: "Claim, Warrant, Impact",
                explanation: "CWI stands for Claim (your main point), Warrant (why it's true), and Impact (why it matters).",
              },
              {
                question: "In the AREO rebuttal framework, what does 'O' stand for?",
                options: ["Organize", "Oppose", "Outweigh", "Observe"],
                correct_answer: "Outweigh",
                explanation: "AREO: Acknowledge, Respond, Evidence, Outweigh. The final step shows why your argument is more important.",
              },
              {
                question: "What percentage of your speech should be the opening?",
                options: ["5%", "10-15%", "25-30%", "40-50%"],
                correct_answer: "10-15%",
                explanation: "Your opening should be 10-15% of your speech time — enough to hook the audience and preview arguments, but not so long that it eats into your substantive content.",
              },
              {
                question: "What is a 'slippery slope' fallacy?",
                options: [
                  "Attacking the person instead of the argument",
                  "Using emotional manipulation instead of logic",
                  "Arguing that one step will inevitably lead to extreme consequences",
                  "Presenting only two options when more exist",
                ],
                correct_answer: "Arguing that one step will inevitably lead to extreme consequences",
                explanation: "A slippery slope claims that one action will chain-react into extreme outcomes without evidence for the connection between steps.",
              },
              {
                question: "Aristotle's three modes of persuasion are:",
                options: [
                  "Ethos, Pathos, Logos",
                  "Ethics, Passion, Logic",
                  "Evidence, Presentation, Language",
                  "Emotion, Practice, Learning",
                ],
                correct_answer: "Ethos, Pathos, Logos",
                explanation: "Ethos (credibility), Pathos (emotion), and Logos (logic) are the three modes of persuasion identified by Aristotle.",
              },
              {
                question: "How many strong arguments should you aim for in a debate speech?",
                options: ["1 argument", "2-3 arguments", "5-6 arguments", "As many as possible"],
                correct_answer: "2-3 arguments",
                explanation: "Quality beats quantity. 2-3 well-developed arguments with strong warrants and impacts are more persuasive than 5-6 shallow points.",
              },
              {
                question: "What is a 'red herring' fallacy?",
                options: [
                  "Making up statistics",
                  "Introducing an irrelevant topic to distract",
                  "Repeating a phrase for emphasis",
                  "Using outdated evidence",
                ],
                correct_answer: "Introducing an irrelevant topic to distract",
                explanation: "A red herring is an argument that diverts attention from the actual topic being discussed to something irrelevant.",
              },
              {
                question: "What is the 'Rule of Three' in rhetoric?",
                options: [
                  "Always have three team members",
                  "Speak for exactly three minutes",
                  "Present ideas in groups of three for memorability",
                  "Use three pieces of evidence per argument",
                ],
                correct_answer: "Present ideas in groups of three for memorability",
                explanation: "The Rule of Three is a rhetorical principle that ideas presented in threes are more engaging, memorable, and persuasive.",
              },
              {
                question: "What should you do first in a rebuttal speech?",
                options: [
                  "Present your new arguments",
                  "Address the opposing team's strongest argument",
                  "Tell a joke to relax the audience",
                  "Summarize your team's case",
                ],
                correct_answer: "Address the opposing team's strongest argument",
                explanation: "Rebuttal speakers should spend their first 1-2 minutes addressing the opposing team's arguments (especially the strongest ones) before moving to their own new material.",
              },
              {
                question: "Why is signposting important in a debate speech?",
                options: [
                  "It makes you sound smarter",
                  "It helps judges follow your speech structure",
                  "It takes up time when you run out of arguments",
                  "It's required by debate rules",
                ],
                correct_answer: "It helps judges follow your speech structure",
                explanation: "Signposting ('My first argument...', 'Moving to my second point...') helps judges clearly identify and evaluate each of your arguments. Without it, arguments blur together.",
              },
            ],
          },
        },
      ],
    },
  ],
};

// ─── COURSE 2: Public Speaking Mastery ─────────────────────────────────

const course2: SeedCourse = {
  title: "Public Speaking Mastery",
  slug: "public-speaking-mastery",
  description:
    "Build confidence and master the art of public speaking — from voice projection and body language to impromptu speaking and persuasive presentations.",
  category: "public_speaking",
  difficulty: "beginner",
  estimated_hours: 6,
  is_published: true,
  modules: [
    // ── Module 1: Voice and Delivery ──
    {
      title: "Voice and Delivery",
      description: "Master the fundamentals of vocal delivery and presence.",
      order_index: 0,
      lessons: [
        {
          title: "The Power of Your Voice",
          slug: "the-power-of-your-voice",
          type: "article",
          video_url: null,
          duration_minutes: 10,
          order_index: 0,
          is_published: true,
          content: {
            markdown: `# The Power of Your Voice

Your voice is your most important tool as a speaker. It's not just about what you say — it's about **how** you say it. Research shows that vocal delivery accounts for nearly 38% of a listener's impression, while the actual words only account for 7% (the remaining 55% is body language).

## The Four Elements of Voice

### 1. Volume
The most basic element: can your audience hear you?

**Common problems:**
- Speaking too quietly (often from nervousness)
- Speaking too loudly (can feel aggressive)
- Maintaining the same volume throughout (monotonous)

**How to improve:**
- **Project from your diaphragm**, not your throat. Place your hand on your stomach — when you speak, you should feel it push out.
- **Adjust to the room** — a small classroom needs a different volume than an auditorium
- **Use volume strategically** — get quieter for emphasis, louder for passion

### 2. Pace
How fast or slow you speak has a huge impact on comprehension and engagement.

**The ideal range:** 130-150 words per minute for formal speaking (slightly slower than conversation).

**Common problems:**
- **Speaking too fast** — usually caused by nervousness. Your audience can't process rapid-fire information.
- **Speaking too slowly** — can bore your audience and make you seem unprepared
- **Constant speed** — varying your pace keeps the audience engaged

**How to improve:**
- **Record yourself** and listen back. Most people are surprised by how fast they actually speak.
- **Practice pausing** — silence is powerful! A 2-second pause after an important point lets it sink in.
- **Slow down for key points**, speed up for transitions and less critical information.

### 3. Pitch
Pitch refers to how high or low your voice sounds.

**Monotone** (same pitch throughout) is the fastest way to lose your audience. Variety in pitch conveys emotion and keeps listeners engaged.

**How to improve:**
- **Raise your pitch slightly** when asking questions or expressing excitement
- **Lower your pitch** for serious, authoritative statements
- **Avoid uptalk** — ending every sentence with a rising pitch (like a question) undermines your authority

### 4. Clarity
Can your audience understand every word?

**Tips for clarity:**
- **Articulate consonants** — especially at the end of words (don't swallow them)
- **Open your mouth** when speaking — many people barely move their lips
- **Avoid filler words** — "um," "uh," "like," "you know" distract from your message
- **Practice tongue twisters** — they genuinely help with articulation

## The Power of the Pause

Pausing is one of the most underrated speaking techniques. A well-timed pause can:

- **Build anticipation** — pause before revealing a key point
- **Show confidence** — nervous speakers rush; confident speakers pause
- **Allow processing** — give your audience time to absorb complex ideas
- **Replace filler words** — instead of "um," just pause silently

**Practice exercise:** Give a 1-minute speech where you deliberately pause for 2 full seconds after each sentence. It will feel awkwardly long, but to the audience, it sounds perfectly natural and confident.

## Speaking in English as a Vietnamese Student

If English isn't your first language, you have unique challenges and advantages:

**Challenges:**
- Pronunciation differences (th, r, l sounds)
- Tendency to speak faster in English due to nervousness
- Vocabulary limitations under pressure

**Advantages:**
- Bilingual speakers are often more aware of language and word choice
- You bring unique perspectives that monolingual speakers don't have
- Slight accents can actually make you more memorable and engaging

**Tips:**
- Practice speaking English out loud daily — even 10 minutes helps
- Focus on stress patterns (English has stressed and unstressed syllables, unlike Vietnamese tones)
- Don't apologize for your accent — own it with confidence

Your voice is a muscle. The more you practice using it intentionally, the stronger and more versatile it becomes.`,
          },
        },
        {
          title: "Watch: Great Speakers and Their Vocal Techniques",
          slug: "watch-vocal-techniques",
          type: "video",
          video_url: "https://www.youtube.com/watch?v=placeholder-vocal-techniques",
          duration_minutes: 8,
          order_index: 1,
          is_published: true,
          content: {
            description: "Watch examples of powerful speakers and analyze their vocal techniques — volume variation, strategic pausing, pitch changes, and clarity.",
            notes: "As you watch, identify:\n1. When do speakers pause and why?\n2. How do they vary their volume?\n3. What makes their delivery engaging vs. monotone?\n4. How do they handle emphasis on key words?",
          },
        },
        {
          title: "Voice and Delivery Quiz",
          slug: "voice-delivery-quiz",
          type: "quiz",
          video_url: null,
          duration_minutes: 5,
          order_index: 2,
          is_published: true,
          content: {
            questions: [
              {
                question: "According to research, what percentage of a listener's impression comes from vocal delivery?",
                options: ["7%", "25%", "38%", "55%"],
                correct_answer: "38%",
                explanation: "Research suggests vocal delivery accounts for ~38% of impression, body language ~55%, and actual words ~7%.",
              },
              {
                question: "What is the ideal speaking pace for formal presentations?",
                options: ["80-100 wpm", "130-150 wpm", "200-220 wpm", "250+ wpm"],
                correct_answer: "130-150 wpm",
                explanation: "130-150 words per minute is the ideal range for formal speaking — slower than conversation but not so slow as to bore the audience.",
              },
              {
                question: "What is 'uptalk' and why should you avoid it?",
                options: [
                  "Speaking too quickly; it confuses the audience",
                  "Ending sentences with rising pitch; it makes statements sound uncertain",
                  "Speaking too loudly; it seems aggressive",
                  "Using big words; it alienates the audience",
                ],
                correct_answer: "Ending sentences with rising pitch; it makes statements sound uncertain",
                explanation: "Uptalk makes declarative statements sound like questions, which undermines your authority and confidence as a speaker.",
              },
              {
                question: "Where should you project your voice from?",
                options: ["Your throat", "Your nose", "Your diaphragm", "Your chest"],
                correct_answer: "Your diaphragm",
                explanation: "Diaphragmatic breathing and projection produces a fuller, more powerful voice without straining your throat.",
              },
              {
                question: "What is the best replacement for filler words like 'um' and 'uh'?",
                options: ["Say 'so' instead", "Speak faster to avoid gaps", "A deliberate pause (silence)", "Repeat the last word"],
                correct_answer: "A deliberate pause (silence)",
                explanation: "A silent pause is powerful and confident. It gives the audience time to process your points and makes you appear more polished.",
              },
            ],
          },
        },
        {
          title: "Practice: Vocal Warm-Up Debate",
          slug: "practice-vocal-warmup",
          type: "practice",
          video_url: null,
          duration_minutes: 10,
          order_index: 3,
          is_published: true,
          content: {
            practice_config: {
              topic_title: "Physical education should be given equal importance as academic subjects",
              topic_category: "Education & School Life",
              suggested_mode: "quick",
              suggested_difficulty: "easy",
              suggested_side: "proposition",
              description: "Focus on your DELIVERY, not just your arguments. Practice: (1) Projecting your voice clearly, (2) Varying your pace — slow down for important points, (3) Using strategic pauses after key statements, (4) Avoiding filler words like 'um' and 'uh'.",
            },
          },
        },
      ],
    },
    // ── Module 2: Body Language and Stage Presence ──
    {
      title: "Body Language and Stage Presence",
      description: "Command the room with confident body language.",
      order_index: 1,
      lessons: [
        {
          title: "Body Language Basics for Speakers",
          slug: "body-language-basics",
          type: "article",
          video_url: null,
          duration_minutes: 10,
          order_index: 0,
          is_published: true,
          content: {
            markdown: `# Body Language Basics for Speakers

Remember that 55% of communication is body language? Let's learn how to use your body to reinforce your message and project confidence — even when you're nervous.

## The Foundation: Posture

Your posture communicates before you say a single word.

### Power Posture:
- **Stand tall** — shoulders back, chin parallel to the ground
- **Feet shoulder-width apart** — a stable, grounded stance
- **Weight evenly distributed** — don't lean to one side or rock back and forth
- **Hands at your sides or in front** — ready to gesture naturally

### What to avoid:
- **Crossing your arms** — signals defensiveness
- **Hands in pockets** — signals casualness or nervousness
- **Fidgeting** — playing with hair, jewelry, or pen distracts the audience
- **Swaying or rocking** — suggests nervousness

## Eye Contact

Eye contact is perhaps the single most powerful non-verbal tool in public speaking.

### The technique:
- **Scan the room** in sections — don't stare at one person or look at the ceiling
- **Hold each person's gaze for 3-5 seconds** before moving to another area
- **Include everyone** — look at people in the back, sides, and front
- **Connect during key points** — make eye contact when delivering your most important arguments

### For debates specifically:
- **Look at the judges** when making arguments — they're your primary audience
- **Briefly look at opponents** when addressing their arguments — it shows confidence
- **Never look at the floor or your notes** for extended periods

## Gestures

Natural, purposeful gestures enhance your message. Robotic or excessive gestures distract from it.

### Effective gestures:
- **Enumeration** — hold up fingers when listing points ("First... Second... Third...")
- **Size and scope** — use your hands to show scale ("a massive problem" with hands wide)
- **Emphasis** — a single firm hand movement downward for emphasis on a word
- **Open palms** — showing open palms signals honesty and openness

### What to avoid:
- **Pointing** at opponents (it's aggressive)
- **Repetitive gestures** — the same movement over and over becomes distracting
- **Too many gestures** — constant hand movement makes you look frantic
- **No gestures at all** — standing completely still looks unnatural

## Movement

Strategic movement can add dynamism to your speech, but aimless wandering is distracting.

### Good movement:
- **Step forward** when making a key point (signals importance)
- **Move to a new position** when transitioning to a new argument
- **Return to center** for your conclusion

### Bad movement:
- **Pacing back and forth** continuously
- **Walking while talking** without purpose
- **Standing behind a podium the entire time** (if you can step out, do it)

## Facial Expressions

Your face should match your message.

- When discussing a serious problem: **concerned expression**
- When presenting your solution: **engaged, slightly smiling**
- When making your closing appeal: **passionate, determined**
- When listening to opponents: **attentive, thoughtful** (not eye-rolling or head-shaking)

## Managing Nervousness Through Body Language

Here's the secret: **your body can trick your brain into feeling confident**.

### The "power pose" technique:
Before your speech (backstage or in the hallway), stand in a "power pose" for 2 minutes:
- Hands on hips, feet wide (like a superhero)
- Or arms raised in a V-shape above your head

Research suggests this can increase confidence hormones and decrease stress hormones. Even if the science is debated, many speakers find it helpful as a pre-performance ritual.

### During your speech:
- **Slow down** — your body language calms your mind
- **Take a deep breath** before starting — visible composure is contagious
- **Smile** — even a brief smile at the start relaxes both you and your audience
- **Focus outward** — instead of thinking "everyone is judging me," think "I have something valuable to share"

Body language is a skill, and like all skills, it improves with practice. The more speeches you give, the more natural confident body language becomes.`,
          },
        },
        {
          title: "Overcoming Stage Fright",
          slug: "overcoming-stage-fright",
          type: "article",
          video_url: null,
          duration_minutes: 8,
          order_index: 1,
          is_published: true,
          content: {
            markdown: `# Overcoming Stage Fright

Stage fright is one of the most common fears in the world. Studies show that public speaking anxiety affects up to 75% of people. If you feel nervous before speaking, you're in good company — and more importantly, it's completely manageable.

## Understanding Stage Fright

Stage fright is your body's **fight-or-flight response** kicking in. Your brain perceives speaking in front of people as a threat, triggering:
- Rapid heartbeat
- Sweaty palms
- Dry mouth
- Shaky voice or hands
- "Blank mind" — forgetting what you wanted to say

**The key insight:** These physical sensations are the same as excitement. The difference is how you interpret them.

## Reframing Nervousness

Instead of telling yourself "I'm so nervous," try: **"I'm excited."**

Research by Harvard psychologist Alison Wood Brooks found that people who reframed anxiety as excitement performed significantly better in public speaking tasks. Your body can't tell the difference between nervousness and excitement — so choose the interpretation that helps you.

## Practical Techniques

### Before Your Speech:

**1. Prepare thoroughly**
The #1 cure for stage fright is preparation. When you know your material inside out, you have a safety net. Even if anxiety makes you forget something, you can recover because you've practiced enough for the material to be second nature.

**2. Practice out loud**
Reading your notes silently is NOT practice. You must say the words out loud, at full volume, ideally standing up. Practice at least 3-5 times before any important speech.

**3. Breathe**
Before you stand up, take 4-7-8 breaths: inhale for 4 seconds, hold for 7, exhale for 8. This activates your parasympathetic nervous system and physically calms you.

**4. Arrive early**
Familiarize yourself with the room. Stand where you'll speak. This reduces the "unknown" factor that fuels anxiety.

### During Your Speech:

**5. Start with something rehearsed**
Memorize your opening sentence. The first 10 seconds are the scariest — if you nail those, confidence builds quickly.

**6. Focus on friendly faces**
Find 2-3 people in the audience who are nodding or smiling. Speak to them first. Their positive response will calm you.

**7. Move**
Physical movement releases tension. Take a step, gesture naturally, turn to address different parts of the room.

**8. Pause when you blank out**
If you lose your train of thought, don't panic. Pause, take a breath, glance at your notes, and continue. The audience perceives a pause as intentional.

### Building Long-Term Confidence:

**9. Expose yourself gradually**
- Start by speaking up in class discussions
- Give short presentations (2-3 minutes)
- Join a debate club
- Volunteer for longer speaking roles
- Each positive experience reduces future anxiety

**10. Record and review**
Watch recordings of your speeches. You'll almost always discover that you look and sound much better than you felt. This evidence helps override your brain's negative bias.

**11. Accept imperfection**
No speech is perfect. Even world-class speakers stumble, lose their place, or get nervous. The goal isn't perfection — it's effective communication.

## A Note for Vietnamese Students

In Vietnamese culture, there can be additional pressure around public speaking — concerns about "losing face" or standing out. Remember:

- **Debate and public speaking are skills**, not personality traits. Introverts can be excellent speakers.
- **Making mistakes is learning**, not failure. Every great speaker has a history of embarrassing moments.
- **Your perspective matters.** The world needs to hear Vietnamese voices and viewpoints.

Stage fright never fully disappears — even experienced speakers feel butterflies. The difference is that experienced speakers have learned to channel that energy into passion and intensity. With practice, you will too.`,
          },
        },
        {
          title: "Body Language and Confidence Quiz",
          slug: "body-language-quiz",
          type: "quiz",
          video_url: null,
          duration_minutes: 5,
          order_index: 2,
          is_published: true,
          content: {
            questions: [
              {
                question: "What percentage of communication is attributed to body language?",
                options: ["7%", "25%", "38%", "55%"],
                correct_answer: "55%",
                explanation: "Research suggests body language accounts for approximately 55% of communication, with vocal tone at 38% and words at 7%.",
              },
              {
                question: "How long should you maintain eye contact with one person before moving on?",
                options: ["1 second", "3-5 seconds", "10 seconds", "30 seconds"],
                correct_answer: "3-5 seconds",
                explanation: "3-5 seconds of eye contact feels natural and connected. Less feels shifty, and more feels like staring.",
              },
              {
                question: "What is the best way to reframe stage fright?",
                options: [
                  "Tell yourself to calm down",
                  "Imagine the audience in their underwear",
                  "Reinterpret nervousness as excitement",
                  "Avoid looking at the audience",
                ],
                correct_answer: "Reinterpret nervousness as excitement",
                explanation: "Research shows that reframing anxiety as excitement is more effective than trying to calm down, because both states have similar physical sensations.",
              },
              {
                question: "What breathing technique can help calm pre-speech nerves?",
                options: [
                  "Quick shallow breaths",
                  "4-7-8 breathing (inhale 4, hold 7, exhale 8)",
                  "Holding your breath for 30 seconds",
                  "Breathing into a paper bag",
                ],
                correct_answer: "4-7-8 breathing (inhale 4, hold 7, exhale 8)",
                explanation: "4-7-8 breathing activates the parasympathetic nervous system, physically calming your body's fight-or-flight response.",
              },
              {
                question: "If you forget what you were going to say during a speech, what should you do?",
                options: [
                  "Apologize and sit down",
                  "Start speaking faster to get past it",
                  "Pause, breathe, glance at notes, and continue",
                  "Make something up to fill the silence",
                ],
                correct_answer: "Pause, breathe, glance at notes, and continue",
                explanation: "A pause looks intentional to the audience. Use it to collect yourself, check your notes, and resume confidently.",
              },
            ],
          },
        },
      ],
    },
    // ── Module 3: Advanced Speaking Skills ──
    {
      title: "Advanced Speaking Skills",
      description: "Master impromptu speaking and persuasive presentations.",
      order_index: 2,
      lessons: [
        {
          title: "Impromptu Speaking: Think on Your Feet",
          slug: "impromptu-speaking",
          type: "article",
          video_url: null,
          duration_minutes: 10,
          order_index: 0,
          is_published: true,
          content: {
            markdown: `# Impromptu Speaking: Think on Your Feet

Impromptu speaking — delivering a speech with little or no preparation — is one of the most valuable skills you can develop. In real life, you rarely have time to prepare a perfect speech. Job interviews, classroom discussions, meetings, and even social situations all require the ability to speak clearly and persuasively on the spot.

## The PREP Framework

When you need to speak with minimal preparation, use the **PREP** method:

1. **P**oint — State your main idea clearly
2. **R**eason — Explain why you believe this
3. **E**xample — Give a concrete example
4. **P**oint — Restate your main idea (closing)

### Example prompt: "Should students be allowed to use phones in class?"

> "I believe students should be allowed to use phones for educational purposes. (Point)
>
> Smartphones are powerful learning tools with access to calculators, dictionaries, research databases, and educational apps that can enhance classroom learning. (Reason)
>
> For example, in my biology class, students who could use their phones to look up diagrams and 3D models of cell structures scored 15% higher on tests than those who only had textbooks. (Example)
>
> So while we should have clear guidelines, allowing educational phone use prepares students for the technology-rich world they'll enter after school. (Point)"

That's a complete, well-structured impromptu response delivered in about 40 seconds.

## The Rule of Three (for Impromptu)

If you have slightly more time (1-2 minutes), expand PREP into three reasons:

1. State your position
2. Give reason/example 1
3. Give reason/example 2
4. Give reason/example 3
5. Conclude

Having exactly three points gives your impromptu speech a sense of structure and completeness that impresses listeners.

## Buying Time (Ethically)

You need a few seconds to organize your thoughts. Here are ways to buy time without saying "um":

- **Repeat the question** — "The question of whether students should use phones in class is an important one..."
- **Acknowledge the complexity** — "This is a nuanced issue with valid arguments on both sides..."
- **Define a key term** — "First, let's consider what we mean by 'allowed'..."

These openings sound thoughtful while giving your brain time to organize an answer.

## Practice Exercises

### Exercise 1: Random Topic Speaking
Set a timer for 1 minute. Open a random Wikipedia article and speak about the topic for a full minute using the PREP framework.

### Exercise 2: Opinion on Demand
Ask a friend to give you a random opinion question. You have 15 seconds of thinking time, then speak for 1 minute.

### Exercise 3: Story from a Word
Someone gives you a random word. Build a 2-minute story or argument that incorporates that word.

### Exercise 4: DebateLab Quick Practice
Use DebateLab's Quick Practice mode with minimal prep time. The AI will give you a topic, and you speak immediately. This is the most debate-specific impromptu practice you can get.

## Tips for Impromptu Success

1. **Always have a structure** — even a simple one (PREP) is better than rambling
2. **Speak slowly** — your audience doesn't know you're making this up as you go
3. **Be specific** — vague answers sound unprepared; specific examples sound knowledgeable
4. **It's okay to be simple** — a clear, straightforward response beats a convoluted attempt to sound smart
5. **Practice daily** — impromptu speaking improves rapidly with practice

Impromptu speaking is the skill that transfers most directly to real life. Every conversation, every meeting, every unexpected question is an opportunity to practice.`,
          },
        },
        {
          title: "The Art of Persuasive Presentations",
          slug: "persuasive-presentations",
          type: "article",
          video_url: null,
          duration_minutes: 10,
          order_index: 1,
          is_published: true,
          content: {
            markdown: `# The Art of Persuasive Presentations

Whether you're presenting a school project, pitching an idea, or leading a meeting, the ability to persuade an audience through a structured presentation is invaluable. Let's combine everything we've learned into the art of the persuasive presentation.

## Structure: The Persuasive Arc

Every great persuasive presentation follows this arc:

### 1. Attention (10%)
Grab the audience's attention immediately. Methods:
- **Startling statistic** — "Every 3 seconds, a football field of forest disappears"
- **Provocative question** — "What if everything you believed about studying was wrong?"
- **Personal story** — "Last year, I almost gave up on debate. Here's what changed..."
- **Bold statement** — "This school's biggest problem isn't funding — it's how we spend it"

### 2. Problem (20%)
Define the problem clearly. The audience needs to feel the problem before they'll accept your solution.
- What's wrong with the current situation?
- Who is affected?
- How serious is the issue?
- What happens if nothing changes?

### 3. Solution (40%)
Present your solution with evidence and reasoning.
- What specifically should change?
- How will it work in practice?
- What evidence supports this approach?
- Address potential objections proactively

### 4. Visualization (20%)
Help the audience see the future.
- **Positive vision** — paint a picture of how things look after your solution is implemented
- **Contrast** — compare the current state with the future state
- **Specific outcomes** — "Within two years, this could mean..."

### 5. Action (10%)
Tell the audience exactly what to do next.
- Make the ask clear and specific
- Make it easy and achievable
- Create urgency — why now?

## Making Data Compelling

Presentations often involve statistics and data. Here's how to make numbers memorable:

### Make it relative:
- Instead of "2.5 million tons of plastic enter the ocean yearly"
- Try: "That's equivalent to dumping a garbage truck of plastic into the ocean every minute"

### Make it personal:
- Instead of "Average student debt is 300 million VND"
- Try: "By the time you graduate, you could owe more than your parents paid for their house"

### Make it visual:
- Use analogies and comparisons
- If using slides, show ONE number per slide, not a table of 20

## Slides: Less is More

If you use slides:
- **One idea per slide** — if your slide has more than 6 words, it has too many
- **Images over text** — a powerful photo is worth a thousand bullet points
- **No reading from slides** — your slides support your speech, they don't replace it
- **Dark backgrounds for presentations, light for handouts**

## Handling Q&A

After your presentation, questions often determine success:
- **Listen fully** before answering — don't interrupt the questioner
- **Repeat the question** so everyone hears it
- **Be honest** — "That's a great question, and I don't have a definitive answer" is better than making something up
- **Bridge back** — use questions as opportunities to reinforce your key message

## Putting It All Together

Combine what you've learned across this entire course:
- **Voice** — project, vary pace and pitch, pause for effect
- **Body language** — confident posture, purposeful gestures, eye contact
- **Structure** — clear opening, body, and closing with signposting
- **Persuasion** — ethos, pathos, and logos working together
- **Evidence** — specific, relevant, and well-presented

Public speaking mastery isn't about being naturally gifted — it's about deliberate practice, honest self-reflection, and continuous improvement. You've now learned the foundational skills. The rest is up to practice.

Congratulations on completing this course! Head to DebateLab's practice mode to put everything into action.`,
          },
        },
        {
          title: "Practice: Persuasive Impromptu Speech",
          slug: "practice-persuasive-impromptu",
          type: "practice",
          video_url: null,
          duration_minutes: 15,
          order_index: 2,
          is_published: true,
          content: {
            practice_config: {
              topic_title: "Every student should learn a musical instrument in school",
              topic_category: "Education & School Life",
              suggested_mode: "quick",
              suggested_difficulty: "medium",
              suggested_side: "random",
              description: "Apply all your public speaking skills in this final practice! Focus on: (1) Strong vocal delivery — volume, pace, pausing, (2) Confident body language, (3) Clear PREP structure, (4) Persuasive techniques — ethos, pathos, logos. Record yourself and review!",
            },
          },
        },
        {
          title: "Public Speaking Final Quiz",
          slug: "public-speaking-final-quiz",
          type: "quiz",
          video_url: null,
          duration_minutes: 8,
          order_index: 3,
          is_published: true,
          content: {
            questions: [
              {
                question: "What does PREP stand for in impromptu speaking?",
                options: [
                  "Practice, Rehearse, Execute, Perfect",
                  "Point, Reason, Example, Point",
                  "Prepare, Research, Evaluate, Present",
                  "Position, Reason, Evidence, Persuade",
                ],
                correct_answer: "Point, Reason, Example, Point",
                explanation: "PREP is a simple framework for impromptu speeches: state your Point, give a Reason, provide an Example, and restate your Point.",
              },
              {
                question: "In the persuasive presentation arc, what comes after defining the Problem?",
                options: ["Action", "Attention", "Solution", "Visualization"],
                correct_answer: "Solution",
                explanation: "The arc is: Attention → Problem → Solution → Visualization → Action.",
              },
              {
                question: "When making a statistic compelling, the best approach is to:",
                options: [
                  "Use as many numbers as possible",
                  "Make it relative and personal",
                  "Read directly from a data table",
                  "Round all numbers to the nearest thousand",
                ],
                correct_answer: "Make it relative and personal",
                explanation: "Statistics become memorable when made relative ('a garbage truck per minute') and personal ('by the time YOU graduate...').",
              },
              {
                question: "What is the ideal number of words per presentation slide?",
                options: ["6 or fewer", "20-30", "50-100", "As many as needed"],
                correct_answer: "6 or fewer",
                explanation: "Less is more with slides. One idea per slide, with minimal text — your slides support your speech, they don't replace it.",
              },
              {
                question: "How should you handle a Q&A question you can't answer?",
                options: [
                  "Make up a confident-sounding answer",
                  "Ignore the question and move on",
                  "Be honest that you don't know, and offer to follow up",
                  "Redirect to a completely different topic",
                ],
                correct_answer: "Be honest that you don't know, and offer to follow up",
                explanation: "Honesty builds credibility (ethos). Admitting you don't know is always better than fabricating an answer.",
              },
              {
                question: "What is the most effective way to buy thinking time during an impromptu speech?",
                options: [
                  "Say 'um' and 'uh' while thinking",
                  "Repeat the question or acknowledge its complexity",
                  "Start talking about something unrelated",
                  "Ask the audience to wait while you think",
                ],
                correct_answer: "Repeat the question or acknowledge its complexity",
                explanation: "Repeating the question or commenting on its complexity sounds thoughtful while giving your brain time to organize a response.",
              },
            ],
          },
        },
      ],
    },
  ],
};

export const SEED_COURSES: SeedCourse[] = [course1, course2];
