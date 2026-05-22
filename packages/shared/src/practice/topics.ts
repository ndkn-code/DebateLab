import type { PracticeLanguage } from "./feedback";
import type { DebateTopic } from "./types";

export const CATEGORIES = [
  "Education & School Life",
  "Technology & Social Media",
  "Society & Culture",
  "Environment & Sustainability",
  "Ethics & Philosophy",
  "Vietnam-Specific Issues",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_CONFIG = [
  {
    key: "education",
    en: "Education & School Life",
    vi: "Giáo Dục & Đời Sống",
  },
  {
    key: "technology",
    en: "Technology & Social Media",
    vi: "Công Nghệ & Mạng Xã Hội",
  },
  {
    key: "society",
    en: "Society & Culture",
    vi: "Xã Hội & Văn Hóa",
  },
  {
    key: "environment",
    en: "Environment & Sustainability",
    vi: "Môi Trường & Bền Vững",
  },
  {
    key: "ethics",
    en: "Ethics & Philosophy",
    vi: "Đạo Đức & Triết Học",
  },
  {
    key: "vietnam",
    en: "Vietnam-Specific Issues",
    vi: "Vấn Đề Việt Nam",
  },
] as const;

export type CategoryKey = (typeof CATEGORY_CONFIG)[number]["key"];
export type CategoryFilterKey = "all" | CategoryKey;

export interface PracticeCategoryOption {
  key: CategoryFilterKey;
  label: string;
}

type TopicTranslation = Pick<
  DebateTopic,
  "title" | "context" | "motionBrief" | "suggestedPoints"
>;

const CATEGORY_KEY_BY_LABEL = new Map<string, CategoryKey>(
  CATEGORY_CONFIG.flatMap((category) => [
    [category.en, category.key],
    [category.vi, category.key],
  ])
);

export function isCategoryKey(value: unknown): value is CategoryKey {
  return CATEGORY_CONFIG.some((category) => category.key === value);
}

export function getCategoryKey(
  category: string | null | undefined
): CategoryKey {
  if (isCategoryKey(category)) {
    return category;
  }

  return CATEGORY_KEY_BY_LABEL.get(category ?? "") ?? "education";
}

export function getCategoryLabel(
  categoryKey: CategoryKey,
  language: PracticeLanguage
) {
  const category =
    CATEGORY_CONFIG.find((candidate) => candidate.key === categoryKey) ??
    CATEGORY_CONFIG[0];

  return category[language];
}

export function getLocalizedCategoryOptions(
  language: PracticeLanguage
): PracticeCategoryOption[] {
  return [
    { key: "all", label: language === "vi" ? "Tất cả" : "All" },
    ...CATEGORY_CONFIG.map((category) => ({
      key: category.key,
      label: category[language],
    })),
  ];
}

export const topics: DebateTopic[] = [
  // ── Education & School Life ──────────────────────────────────────
  {
    id: "edu-01",
    title: "Homework should be abolished in high schools",
    category: "Education & School Life",
    difficulty: "beginner",
    context:
      "Many educators debate whether homework improves learning outcomes or simply adds unnecessary stress to students' lives.",
    motionBrief: {
      keyTerms: [
        "homework: assigned academic work completed outside class time",
        "abolished: removed as a regular requirement, not banning optional revision",
        "high schools: students in the final years before university",
      ],
      scope:
        "The debate is about regular compulsory homework across high school subjects, not short in-class practice, optional revision, or exam accommodations.",
      propositionBurden:
        "Show that compulsory homework creates more educational and wellbeing harm than benefit, and that class time or targeted support can replace it.",
      oppositionBurden:
        "Show that homework adds learning, discipline, feedback, or family visibility that schools cannot reliably replace during class.",
      modelClarification:
        "If defending abolition, keep the model as removal of mandatory take-home assignments while allowing optional revision and targeted catch-up support.",
    },
    suggestedPoints: {
      proposition: [
        "Homework causes excessive stress and reduces time for extracurricular development",
        "Studies show diminishing returns of homework on academic performance in high school",
        "Class time should be sufficient for learning if teaching methods are effective",
      ],
      opposition: [
        "Homework reinforces classroom learning and builds independent study habits",
        "It prepares students for the self-discipline required in university and careers",
        "Parents can monitor academic progress through homework assignments",
      ],
    },
  },
  {
    id: "edu-02",
    title: "Online learning is more effective than traditional classroom learning",
    category: "Education & School Life",
    difficulty: "intermediate",
    context:
      "The COVID-19 pandemic accelerated the adoption of online learning, sparking debate about its long-term effectiveness compared to in-person education.",
    suggestedPoints: {
      proposition: [
        "Online learning offers flexible pacing and personalized learning paths",
        "Students can access world-class resources and teachers regardless of location",
        "Digital tools enable better tracking of student progress and engagement",
      ],
      opposition: [
        "In-person interaction is essential for social development and collaboration skills",
        "Many students lack the self-discipline needed for effective online learning",
        "Hands-on subjects like science labs and arts require physical presence",
      ],
    },
  },
  {
    id: "edu-03",
    title: "Students should be allowed to use AI tools for schoolwork",
    category: "Education & School Life",
    difficulty: "advanced",
    context:
      "With the rise of ChatGPT and similar AI tools, schools worldwide are grappling with whether to embrace or restrict AI in academic settings.",
    suggestedPoints: {
      proposition: [
        "AI literacy is an essential 21st-century skill students must develop early",
        "AI can serve as a personalized tutor, helping students understand difficult concepts",
        "Banning AI is impractical — education should teach responsible use instead",
      ],
      opposition: [
        "AI use undermines critical thinking and genuine learning when used as a shortcut",
        "It creates unfair advantages between students with different levels of AI access",
        "Teachers cannot accurately assess student understanding if AI generates the work",
      ],
    },
  },
  {
    id: "edu-04",
    title: "Gap years should be encouraged before university",
    category: "Education & School Life",
    difficulty: "beginner",
    context:
      "Gap years between high school and university are common in Western countries but remain unusual in many Asian education systems.",
    suggestedPoints: {
      proposition: [
        "Gap years help students discover their passions before committing to a major",
        "Real-world experience builds maturity and clearer academic motivation",
        "Students who take gap years often perform better academically afterward",
      ],
      opposition: [
        "A year off can break academic momentum and study habits",
        "Not all families can afford the financial cost of a delayed education",
        "Students may struggle to re-enter the academic environment after a break",
      ],
    },
  },
  {
    id: "edu-05",
    title:
      "Standardized testing should be replaced with project-based assessment",
    category: "Education & School Life",
    difficulty: "intermediate",
    context:
      "Critics argue standardized tests measure memorization rather than real understanding, while supporters value their objectivity and scalability.",
    suggestedPoints: {
      proposition: [
        "Projects assess deeper understanding, creativity, and practical application",
        "Standardized tests favor rote memorization over critical thinking skills",
        "Project-based assessment better prepares students for real-world challenges",
      ],
      opposition: [
        "Standardized tests provide objective, comparable data across schools and regions",
        "Project grading is subjective and difficult to standardize fairly",
        "Some essential skills like math and reading comprehension are best tested in exams",
      ],
    },
  },
  {
    id: "edu-06",
    title: "Schools should teach financial literacy as a mandatory subject",
    category: "Education & School Life",
    difficulty: "beginner",
    context:
      "Many young adults struggle with personal finance, leading to calls for schools to include financial education in their core curriculum.",
    suggestedPoints: {
      proposition: [
        "Financial illiteracy leads to poor decisions about debt, savings, and investments",
        "Schools have a responsibility to prepare students for real-life challenges",
        "Early financial education reduces wealth inequality across socioeconomic groups",
      ],
      opposition: [
        "Financial literacy is better taught by parents within their family's context",
        "Adding more mandatory subjects overloads an already packed curriculum",
        "Financial concepts are too abstract for younger students to meaningfully apply",
      ],
    },
  },

  // ── Technology & Social Media ────────────────────────────────────
  {
    id: "tech-01",
    title: "Social media does more harm than good for teenagers",
    category: "Technology & Social Media",
    difficulty: "beginner",
    context:
      "Research links heavy social media use to rising rates of anxiety, depression, and cyberbullying among teenagers worldwide.",
    suggestedPoints: {
      proposition: [
        "Social media contributes to anxiety, depression, and poor self-image in teens",
        "Cyberbullying on platforms causes lasting psychological harm",
        "Addictive design features exploit developing brains and reduce productivity",
      ],
      opposition: [
        "Social media helps teens build communities and find support networks",
        "It provides access to educational content and diverse perspectives",
        "The issue is misuse, not the platforms themselves — digital literacy is the solution",
      ],
    },
  },
  {
    id: "tech-02",
    title: "Artificial intelligence will replace most human jobs",
    category: "Technology & Social Media",
    difficulty: "advanced",
    context:
      "AI automation is transforming industries from manufacturing to creative work, raising questions about the future of human employment.",
    suggestedPoints: {
      proposition: [
        "AI can perform routine cognitive and physical tasks faster and cheaper than humans",
        "Historical patterns show technology consistently displaces entire job categories",
        "AI is now entering creative and professional fields previously thought safe from automation",
      ],
      opposition: [
        "AI creates new job categories and industries that don't exist yet",
        "Human skills like empathy, creativity, and judgment remain irreplaceable",
        "Previous technological revolutions created more jobs than they destroyed",
      ],
    },
  },
  {
    id: "tech-03",
    title: "Smartphones should be banned in schools",
    category: "Technology & Social Media",
    difficulty: "beginner",
    context:
      "Several countries have implemented smartphone bans in schools, citing improved focus and social interaction among students.",
    motionBrief: {
      keyTerms: [
        "smartphones: personal internet-connected phones owned by students",
        "banned in schools: not accessible during the school day on campus",
        "schools: classrooms, breaks, and school-supervised activities",
      ],
      scope:
        "The motion concerns students' personal smartphones during the school day. It does not ban school-owned devices, medical exceptions, disability accommodations, or emergency office contact.",
      propositionBurden:
        "Defend a school-day ban and prove it improves attention, learning, safety, or student wellbeing more than managed phone use.",
      oppositionBurden:
        "Show that a blanket school-day ban is unnecessary or harmful, and that regulated/educational use solves distractions with fewer costs.",
      modelClarification:
        "A consistent proposition model is a complete school-day ban on personal student smartphones, with narrow exceptions for medical needs, disability access, or emergencies handled through staff.",
    },
    suggestedPoints: {
      proposition: [
        "Smartphones are the primary source of distraction in classrooms",
        "Bans improve face-to-face social interaction during breaks",
        "Schools that banned phones report improved academic performance",
      ],
      opposition: [
        "Smartphones are valuable learning tools when used properly",
        "Students need to learn self-regulation rather than face blanket bans",
        "Phones are essential for student safety and parent communication",
      ],
    },
  },
  {
    id: "tech-04",
    title: "The government should regulate social media platforms",
    category: "Technology & Social Media",
    difficulty: "intermediate",
    context:
      "Governments worldwide are debating how to regulate tech companies to protect users while preserving innovation and free speech.",
    suggestedPoints: {
      proposition: [
        "Platforms have failed to self-regulate against misinformation and hate speech",
        "User data privacy requires legal protections that only governments can enforce",
        "Regulation ensures accountability for algorithms that harm public discourse",
      ],
      opposition: [
        "Government regulation risks censorship and stifling free expression",
        "Tech evolves faster than legislation, making regulations quickly outdated",
        "Over-regulation could push innovation to less regulated countries",
      ],
    },
  },
  {
    id: "tech-05",
    title: "Technology is making people less creative",
    category: "Technology & Social Media",
    difficulty: "intermediate",
    context:
      "While technology provides powerful creative tools, critics argue it promotes consumption over creation and homogenizes culture.",
    suggestedPoints: {
      proposition: [
        "Constant digital consumption leaves less time for original creative thought",
        "Algorithm-driven content creates echo chambers and homogenized trends",
        "Copy-paste culture and templates reduce the need for original creation",
      ],
      opposition: [
        "Technology democratizes creative tools — anyone can produce music, art, or film",
        "Digital platforms enable new art forms like digital art, VR experiences, and remixing",
        "Collaboration tools allow creative partnerships across the globe",
      ],
    },
  },
  {
    id: "tech-06",
    title: "Online privacy is more important than national security",
    category: "Technology & Social Media",
    difficulty: "advanced",
    context:
      "Governments argue that surveillance programs are necessary for security, while privacy advocates warn of overreach and abuse of power.",
    suggestedPoints: {
      proposition: [
        "Mass surveillance violates fundamental human rights to privacy",
        "Government surveillance powers are frequently abused for political purposes",
        "Strong encryption and privacy protect journalists, activists, and minorities",
      ],
      opposition: [
        "Intelligence agencies need data access to prevent terrorism and cybercrime",
        "Citizens who have nothing to hide should not fear reasonable monitoring",
        "National security threats can cause far greater harm than privacy limitations",
      ],
    },
  },

  // ── Society & Culture ────────────────────────────────────────────
  {
    id: "soc-01",
    title: "The voting age should be lowered to 16",
    category: "Society & Culture",
    difficulty: "intermediate",
    context:
      "Several countries and cities have lowered the voting age to 16, arguing that teenagers are informed enough to participate in democracy.",
    suggestedPoints: {
      proposition: [
        "16-year-olds pay taxes, can work, and are affected by political decisions",
        "Early voting creates lifelong civic engagement habits",
        "Young people deserve a voice on issues like climate change that affect their future",
      ],
      opposition: [
        "Most 16-year-olds lack the life experience for informed political decisions",
        "Brain development research shows the prefrontal cortex isn't mature until 25",
        "Teens are more susceptible to political manipulation and peer pressure",
      ],
    },
  },
  {
    id: "soc-02",
    title: "Fast fashion should be banned",
    category: "Society & Culture",
    difficulty: "intermediate",
    context:
      "Fast fashion brands produce cheap, trendy clothing at enormous environmental and human cost, with millions of tons of textile waste generated annually.",
    suggestedPoints: {
      proposition: [
        "Fast fashion is one of the top polluting industries globally",
        "It relies on exploitative labor practices in developing countries",
        "Banning fast fashion would drive innovation in sustainable textiles",
      ],
      opposition: [
        "Affordable clothing is essential for low-income families",
        "Bans would eliminate millions of manufacturing jobs in developing nations",
        "Consumer education and regulation are more practical than outright bans",
      ],
    },
  },
  {
    id: "soc-03",
    title: "Public transportation should be free",
    category: "Society & Culture",
    difficulty: "beginner",
    context:
      "Some cities have experimented with free public transit to reduce car usage, lower emissions, and improve access for low-income residents.",
    suggestedPoints: {
      proposition: [
        "Free transit reduces traffic congestion and carbon emissions",
        "It improves mobility for low-income communities who depend on public transport",
        "The economic benefits of increased mobility outweigh the cost of subsidies",
      ],
      opposition: [
        "Free transit would require massive tax increases to fund operations",
        "It could lead to overcrowding and reduced service quality",
        "Revenue from fares is needed for infrastructure maintenance and expansion",
      ],
    },
  },
  {
    id: "soc-04",
    title: "Animal testing should be completely banned",
    category: "Society & Culture",
    difficulty: "intermediate",
    context:
      "Over 100 million animals are used in laboratory testing annually for medical research, cosmetics, and product safety.",
    suggestedPoints: {
      proposition: [
        "Animals experience suffering and have a right not to be used as test subjects",
        "Modern alternatives like cell cultures and computer models can replace animal testing",
        "Animal testing results often don't accurately translate to human outcomes",
      ],
      opposition: [
        "Animal testing has been essential for life-saving medical breakthroughs",
        "Current alternatives cannot fully replicate complex biological systems",
        "Strict regulations already minimize animal suffering in research",
      ],
    },
  },
  {
    id: "soc-05",
    title: "Community service should be mandatory for graduation",
    category: "Society & Culture",
    difficulty: "beginner",
    context:
      "Some schools require students to complete community service hours before graduating, aiming to build civic responsibility and empathy.",
    suggestedPoints: {
      proposition: [
        "Community service develops empathy and social responsibility in students",
        "It exposes students to diverse communities and real-world problems",
        "Mandatory service creates a culture of giving back that lasts beyond school",
      ],
      opposition: [
        "Forced volunteering contradicts the spirit of genuine community service",
        "It adds another burden to students already overwhelmed with academics",
        "Quality of service suffers when students are only doing it to fulfill a requirement",
      ],
    },
  },
  {
    id: "soc-06",
    title: "Cancel culture does more harm than good",
    category: "Society & Culture",
    difficulty: "advanced",
    context:
      "Cancel culture refers to the practice of withdrawing support from public figures who have done or said something objectionable, often via social media campaigns.",
    motionBrief: {
      keyTerms: [
        "cancel culture: public campaigns to withdraw support or impose reputational consequences",
        "harm: unfair punishment, fear, polarization, or loss of dialogue",
        "good: accountability, victim protection, and social norm enforcement",
      ],
      scope:
        "The debate is about informal public and online accountability campaigns, not formal legal punishment or private criticism between individuals.",
      propositionBurden:
        "Show that cancellation usually produces disproportionate, unfair, or chilling effects that outweigh its accountability benefits.",
      oppositionBurden:
        "Show that public pressure is a necessary accountability tool, especially when institutions fail, and that harms can be limited.",
      modelClarification:
        "Keep the debate comparative: the question is whether the social practice overall does more harm than good, not whether every public criticism is illegitimate.",
    },
    suggestedPoints: {
      proposition: [
        "Cancel culture stifles free speech and open dialogue by creating a climate of fear",
        "It often lacks due process and punishes people disproportionately",
        "It discourages growth and redemption by permanently defining people by their mistakes",
      ],
      opposition: [
        "It holds powerful people accountable when traditional systems fail",
        "Marginalized communities use it as a tool to challenge systemic injustice",
        "Public criticism is a form of free speech, not censorship",
      ],
    },
  },

  // ── Environment & Sustainability ─────────────────────────────────
  {
    id: "env-01",
    title: "Nuclear energy is the best solution to climate change",
    category: "Environment & Sustainability",
    difficulty: "advanced",
    context:
      "Nuclear power produces minimal carbon emissions but raises concerns about safety, waste disposal, and the risk of catastrophic accidents.",
    suggestedPoints: {
      proposition: [
        "Nuclear produces massive energy output with near-zero carbon emissions",
        "It provides reliable baseload power unlike intermittent solar and wind",
        "Modern reactor designs are significantly safer than older generations",
      ],
      opposition: [
        "Nuclear disasters like Chernobyl and Fukushima show catastrophic risks",
        "Radioactive waste remains dangerous for thousands of years with no permanent solution",
        "Renewables with battery storage are now cheaper and faster to deploy",
      ],
    },
  },
  {
    id: "env-02",
    title:
      "Individual actions can make a significant impact on climate change",
    category: "Environment & Sustainability",
    difficulty: "beginner",
    context:
      "While corporations produce the majority of emissions, individuals are encouraged to reduce their carbon footprint through lifestyle changes.",
    suggestedPoints: {
      proposition: [
        "Consumer choices drive corporate behavior — reduced demand forces change",
        "Individual actions like diet changes and reduced flying have measurable impact",
        "Grassroots movements start with individual commitment and inspire collective action",
      ],
      opposition: [
        "100 companies are responsible for 71% of global emissions — individual action is a distraction",
        "Systemic change through policy and regulation is far more impactful",
        "Placing responsibility on individuals lets corporations avoid accountability",
      ],
    },
  },
  {
    id: "env-03",
    title: "Plastic should be completely banned",
    category: "Environment & Sustainability",
    difficulty: "beginner",
    context:
      "Over 300 million tons of plastic are produced annually, with much of it ending up in oceans and landfills, taking centuries to decompose.",
    suggestedPoints: {
      proposition: [
        "Plastic pollution is destroying marine ecosystems and entering our food chain",
        "Sustainable alternatives like biodegradable materials already exist",
        "A ban would force innovation in packaging and materials science",
      ],
      opposition: [
        "Plastic is essential in medical equipment, safety gear, and food preservation",
        "Complete bans are impractical — better recycling infrastructure is the solution",
        "Alternative materials often have higher carbon footprints in production",
      ],
    },
  },
  {
    id: "env-04",
    title:
      "Developed countries should pay climate reparations to developing nations",
    category: "Environment & Sustainability",
    difficulty: "advanced",
    context:
      "Developing nations bear the worst effects of climate change despite contributing the least to historical emissions, sparking calls for climate justice.",
    suggestedPoints: {
      proposition: [
        "Developed nations are historically responsible for the majority of cumulative emissions",
        "Climate change disproportionately harms developing nations least able to adapt",
        "Reparations would fund essential adaptation and green transition infrastructure",
      ],
      opposition: [
        "Current generations shouldn't pay for historical emissions they didn't cause",
        "Reparation mechanisms are complex, prone to corruption, and hard to implement fairly",
        "Technology transfer and trade partnerships are more effective than direct payments",
      ],
    },
  },
  {
    id: "env-05",
    title: "Electric vehicles should be mandatory by 2035",
    category: "Environment & Sustainability",
    difficulty: "intermediate",
    context:
      "Several countries have announced plans to ban new internal combustion engine vehicle sales by 2035, pushing for full EV adoption.",
    suggestedPoints: {
      proposition: [
        "Transportation is a leading source of carbon emissions that EVs can drastically cut",
        "EV technology is mature enough for mass adoption with falling battery costs",
        "Clear deadlines drive industry investment and infrastructure development",
      ],
      opposition: [
        "EV infrastructure is insufficient in rural areas and developing regions",
        "Battery production has significant environmental and ethical concerns (mining)",
        "Mandates disproportionately burden low-income consumers who can't afford EVs",
      ],
    },
  },

  // ── Ethics & Philosophy ──────────────────────────────────────────
  {
    id: "eth-01",
    title: "The ends justify the means",
    category: "Ethics & Philosophy",
    difficulty: "advanced",
    context:
      "This classic philosophical debate pits consequentialism against deontological ethics, asking whether outcomes alone determine the morality of actions.",
    suggestedPoints: {
      proposition: [
        "Moral value should be measured by the outcomes and overall well-being produced",
        "Rigid moral rules can lead to worse outcomes when applied inflexibly",
        "Real-world decision-making always involves trade-offs between principles and results",
      ],
      opposition: [
        "Allowing immoral means sets dangerous precedents regardless of the outcome",
        "We cannot reliably predict outcomes, so we must judge actions by their inherent morality",
        "Human rights and dignity must never be sacrificed for utilitarian calculations",
      ],
    },
  },
  {
    id: "eth-02",
    title: "Freedom of speech should have no limits",
    category: "Ethics & Philosophy",
    difficulty: "intermediate",
    context:
      "Free speech is considered a fundamental right, but debates continue about whether hate speech, misinformation, and incitement should be restricted.",
    suggestedPoints: {
      proposition: [
        "Any restriction on speech creates a slippery slope toward censorship",
        "The marketplace of ideas requires all viewpoints to be heard and challenged",
        "Governments cannot be trusted to decide which speech is acceptable",
      ],
      opposition: [
        "Hate speech and incitement to violence cause real, measurable harm",
        "Unregulated speech allows powerful actors to spread dangerous misinformation",
        "Most democracies successfully balance free expression with reasonable limits",
      ],
    },
  },
  {
    id: "eth-03",
    title: "It is ethical to eat meat",
    category: "Ethics & Philosophy",
    difficulty: "intermediate",
    context:
      "The ethics of meat consumption are debated from perspectives of animal welfare, environmental impact, cultural traditions, and nutritional needs.",
    suggestedPoints: {
      proposition: [
        "Humans have evolved as omnivores and meat is part of our natural diet",
        "Ethical farming practices can ensure animal welfare while providing nutrition",
        "Meat consumption is deeply tied to cultural identity and traditions worldwide",
      ],
      opposition: [
        "Animals are sentient beings capable of suffering and deserve moral consideration",
        "Plant-based diets can provide complete nutrition without animal exploitation",
        "Meat production is a leading cause of deforestation and greenhouse gas emissions",
      ],
    },
  },
  {
    id: "eth-04",
    title: "Censorship is never justified in a democracy",
    category: "Ethics & Philosophy",
    difficulty: "advanced",
    context:
      "Democracies value free expression but often restrict content related to national security, public safety, or vulnerable populations.",
    suggestedPoints: {
      proposition: [
        "Censorship fundamentally contradicts democratic values of open discourse",
        "Citizens must have access to all information to make informed democratic decisions",
        "History shows censorship is consistently used to suppress dissent and minorities",
      ],
      opposition: [
        "Protecting national security sometimes requires restricting sensitive information",
        "Content involving child exploitation must be censored without exception",
        "Democracies have a duty to protect citizens from harmful misinformation during crises",
      ],
    },
  },
  {
    id: "eth-05",
    title: "Civil disobedience is a valid form of protest",
    category: "Ethics & Philosophy",
    difficulty: "intermediate",
    context:
      "From Gandhi to Martin Luther King Jr., civil disobedience has been used to challenge unjust laws, but critics argue it undermines the rule of law.",
    suggestedPoints: {
      proposition: [
        "History shows civil disobedience has been essential for achieving social justice",
        "When legal channels fail, peaceful law-breaking is the last resort for the oppressed",
        "Civil disobedience draws public attention to injustice in ways legal protest cannot",
      ],
      opposition: [
        "Breaking laws, even unjustly, undermines the democratic legal framework",
        "Civil disobedience can escalate into violence and public disorder",
        "Democratic systems provide legal mechanisms for change that should be exhausted first",
      ],
    },
  },

  // ── Vietnam-Specific Issues ──────────────────────────────────────
  {
    id: "vn-01",
    title: "Vietnam should adopt a 4-day work week",
    category: "Vietnam-Specific Issues",
    difficulty: "intermediate",
    context:
      "Several countries are trialing 4-day work weeks with positive results, but Vietnam's developing economy raises questions about whether it's practical.",
    suggestedPoints: {
      proposition: [
        "Studies show a 4-day week increases productivity and reduces burnout",
        "Vietnam's young workforce values work-life balance — this attracts top talent",
        "Reduced commuting lowers carbon emissions and urban congestion",
      ],
      opposition: [
        "Vietnam's economy is still developing and cannot afford reduced working hours",
        "Many industries like manufacturing require continuous operations",
        "Competitive pressure from regional economies would increase if Vietnam works less",
      ],
    },
  },
  {
    id: "vn-02",
    title: "Vietnamese students face too much academic pressure",
    category: "Vietnam-Specific Issues",
    difficulty: "beginner",
    context:
      "Vietnamese students often attend multiple tutoring classes outside school hours, with intense pressure to perform well on national exams.",
    suggestedPoints: {
      proposition: [
        "Excessive pressure leads to mental health issues, burnout, and loss of childhood",
        "The focus on exam scores doesn't develop the skills modern employers need",
        "Countries with less academic pressure still achieve strong educational outcomes",
      ],
      opposition: [
        "Academic rigor has driven Vietnam's impressive educational development",
        "High expectations motivate students to achieve their full potential",
        "The pressure reflects a cultural value of education that has lifted millions from poverty",
      ],
    },
  },
  {
    id: "vn-03",
    title: "English should become a second official language in Vietnam",
    category: "Vietnam-Specific Issues",
    difficulty: "advanced",
    context:
      "Vietnam has invested heavily in English education, with English being taught from primary school, but it lacks official language status.",
    suggestedPoints: {
      proposition: [
        "Official English status would accelerate Vietnam's integration into the global economy",
        "It would improve access to international education and research resources",
        "Vietnam's growing tech and tourism sectors would benefit enormously",
      ],
      opposition: [
        "It could marginalize Vietnamese language and cultural identity",
        "Implementation would be extremely costly and create urban-rural inequality",
        "Other Asian economic powers thrive without making English an official language",
      ],
    },
  },
  {
    id: "vn-04",
    title: "Vietnam's education system focuses too much on memorization",
    category: "Vietnam-Specific Issues",
    difficulty: "beginner",
    context:
      "While Vietnam performs well on international tests, critics argue the education system prioritizes rote learning over critical thinking and creativity.",
    motionBrief: {
      keyTerms: [
        "Vietnam's education system: mainstream K-12 schooling and exam culture",
        "memorization: learning by recall and repetition without enough application",
        "too much: the balance crowds out critical thinking, creativity, or problem solving",
      ],
      scope:
        "The motion is not saying memorization has no value. It asks whether the current balance in Vietnamese schooling over-prioritizes rote recall compared with analytical and creative learning.",
      propositionBurden:
        "Show that the current emphasis on memorization causes concrete harms to students' skills, motivation, or workforce readiness.",
      oppositionBurden:
        "Show that memorization is a necessary foundation, that the system is changing, or that claimed harms come from other pressures rather than memorization itself.",
      modelClarification:
        "A consistent proposition should argue for rebalancing assessment and classroom methods, not abolishing all memorization.",
    },
    suggestedPoints: {
      proposition: [
        "Memorization-based learning doesn't prepare students for creative problem-solving",
        "Employers consistently report that graduates lack critical thinking skills",
        "Countries that emphasize analytical skills outperform in innovation and entrepreneurship",
      ],
      opposition: [
        "Strong foundational knowledge through memorization is necessary before higher-order thinking",
        "Vietnam's PISA scores prove the current system is effective by international standards",
        "The system is already modernizing with recent curriculum reforms",
      ],
    },
  },
  {
    id: "vn-05",
    title: "Tourism does more harm than good to Vietnamese culture",
    category: "Vietnam-Specific Issues",
    difficulty: "intermediate",
    context:
      "Vietnam's tourism industry has grown rapidly, bringing economic benefits but also concerns about cultural commodification and environmental damage.",
    suggestedPoints: {
      proposition: [
        "Mass tourism commercializes sacred sites and traditional practices",
        "Tourist infrastructure displaces local communities and raises living costs",
        "Environmental damage to natural landmarks like Ha Long Bay threatens heritage",
      ],
      opposition: [
        "Tourism provides vital income and employment for millions of Vietnamese",
        "Cultural exchange increases global appreciation for Vietnamese traditions",
        "Tourism revenue funds preservation of historical sites and cultural programs",
      ],
    },
  },
];

const VI_TOPIC_TRANSLATIONS: Record<string, TopicTranslation> = {
  "edu-01": {
    title: "Nên bãi bỏ bài tập về nhà ở bậc trung học",
    context:
      "Nhiều nhà giáo dục tranh luận liệu bài tập về nhà có thật sự cải thiện kết quả học tập hay chỉ tạo thêm căng thẳng không cần thiết cho học sinh.",
    motionBrief: {
      keyTerms: [
        "bài tập về nhà: nhiệm vụ học tập bắt buộc làm ngoài giờ lên lớp",
        "bãi bỏ: bỏ yêu cầu thường xuyên, không cấm ôn tập tự nguyện",
        "bậc trung học: học sinh ở giai đoạn trước đại học",
      ],
      scope:
        "Tranh luận xoay quanh bài tập bắt buộc đem về nhà, không phải luyện tập ngắn trên lớp, ôn tập tự chọn hay hỗ trợ riêng cho học sinh cần bắt kịp.",
      propositionBurden:
        "Chứng minh bài tập bắt buộc gây hại cho học tập và sức khỏe tinh thần nhiều hơn lợi ích, và lớp học hoặc hỗ trợ mục tiêu có thể thay thế.",
      oppositionBurden:
        "Chứng minh bài tập tạo thêm học tập, kỷ luật, phản hồi hoặc sự theo dõi từ gia đình mà lớp học khó thay thế ổn định.",
      modelClarification:
        "Nếu ủng hộ bãi bỏ, giữ mô hình là bỏ bài tập về nhà bắt buộc nhưng vẫn cho phép ôn tập tự nguyện và hỗ trợ bắt kịp có mục tiêu.",
    },
    suggestedPoints: {
      proposition: [
        "Bài tập về nhà gây căng thẳng quá mức và làm giảm thời gian phát triển ngoại khóa",
        "Nhiều nghiên cứu cho thấy hiệu quả của bài tập về nhà ở bậc trung học giảm dần",
        "Nếu phương pháp dạy hiệu quả, thời gian trên lớp nên đủ để học sinh nắm bài",
      ],
      opposition: [
        "Bài tập về nhà củng cố kiến thức trên lớp và xây thói quen tự học",
        "Nó chuẩn bị cho học sinh tính kỷ luật cần có ở đại học và trong công việc",
        "Phụ huynh có thể theo dõi tiến độ học tập thông qua bài tập được giao",
      ],
    },
  },
  "edu-02": {
    title: "Học trực tuyến hiệu quả hơn học trong lớp truyền thống",
    context:
      "Đại dịch COVID-19 thúc đẩy học trực tuyến, làm dấy lên tranh luận về hiệu quả lâu dài của nó so với giáo dục trực tiếp.",
    suggestedPoints: {
      proposition: [
        "Học trực tuyến cho phép học theo tốc độ cá nhân và lộ trình phù hợp hơn",
        "Học sinh có thể tiếp cận tài nguyên và giáo viên chất lượng cao bất kể địa điểm",
        "Công cụ số giúp theo dõi tiến độ và mức độ tham gia của học sinh tốt hơn",
      ],
      opposition: [
        "Tương tác trực tiếp rất cần cho kỹ năng xã hội và hợp tác",
        "Nhiều học sinh thiếu kỷ luật tự học để học online hiệu quả",
        "Các môn cần thực hành như thí nghiệm khoa học và nghệ thuật cần không gian trực tiếp",
      ],
    },
  },
  "edu-03": {
    title: "Học sinh nên được phép dùng công cụ AI cho bài tập",
    context:
      "Sự xuất hiện của ChatGPT và các công cụ AI tương tự khiến trường học trên thế giới phải cân nhắc nên chấp nhận hay hạn chế AI trong học tập.",
    suggestedPoints: {
      proposition: [
        "Hiểu biết về AI là kỹ năng thiết yếu của thế kỷ 21 mà học sinh cần học sớm",
        "AI có thể đóng vai trò gia sư cá nhân, giúp học sinh hiểu khái niệm khó",
        "Cấm AI là thiếu thực tế; giáo dục nên dạy cách sử dụng có trách nhiệm",
      ],
      opposition: [
        "Dùng AI như lối tắt làm suy yếu tư duy phản biện và việc học thật",
        "Nó tạo lợi thế không công bằng giữa học sinh có mức tiếp cận AI khác nhau",
        "Giáo viên khó đánh giá đúng năng lực nếu AI tạo ra bài làm",
      ],
    },
  },
  "edu-04": {
    title: "Nên khuyến khích học sinh gap year trước đại học",
    context:
      "Gap year giữa trung học và đại học phổ biến ở nhiều nước phương Tây nhưng vẫn chưa quen thuộc trong nhiều hệ thống giáo dục châu Á.",
    suggestedPoints: {
      proposition: [
        "Gap year giúp học sinh khám phá đam mê trước khi chọn ngành",
        "Trải nghiệm thực tế giúp các em trưởng thành và có động lực học rõ hơn",
        "Học sinh gap year thường học tốt hơn khi quay lại môi trường đại học",
      ],
      opposition: [
        "Một năm nghỉ có thể làm đứt mạch học tập và thói quen học",
        "Không phải gia đình nào cũng đủ khả năng chi trả cho việc học bị kéo dài",
        "Học sinh có thể khó hòa nhập lại với môi trường học thuật sau thời gian nghỉ",
      ],
    },
  },
  "edu-05": {
    title: "Nên thay thế thi chuẩn hóa bằng đánh giá theo dự án",
    context:
      "Người phản đối cho rằng bài thi chuẩn hóa đo khả năng ghi nhớ hơn là hiểu sâu, trong khi người ủng hộ đánh giá cao tính khách quan và khả năng so sánh.",
    suggestedPoints: {
      proposition: [
        "Dự án đánh giá hiểu sâu, sáng tạo và khả năng ứng dụng thực tế",
        "Thi chuẩn hóa ưu tiên học thuộc hơn kỹ năng tư duy phản biện",
        "Đánh giá theo dự án chuẩn bị học sinh tốt hơn cho thách thức đời thực",
      ],
      opposition: [
        "Thi chuẩn hóa cung cấp dữ liệu khách quan, so sánh được giữa trường và vùng",
        "Chấm dự án dễ chủ quan và khó chuẩn hóa công bằng",
        "Một số kỹ năng cốt lõi như toán và đọc hiểu vẫn phù hợp với bài thi",
      ],
    },
  },
  "edu-06": {
    title: "Trường học nên dạy tài chính cá nhân như môn bắt buộc",
    context:
      "Nhiều người trẻ gặp khó khăn với tài chính cá nhân, dẫn đến lời kêu gọi đưa giáo dục tài chính vào chương trình chính khóa.",
    suggestedPoints: {
      proposition: [
        "Thiếu hiểu biết tài chính dẫn đến quyết định kém về nợ, tiết kiệm và đầu tư",
        "Trường học có trách nhiệm chuẩn bị học sinh cho vấn đề thực tế",
        "Giáo dục tài chính sớm giúp giảm bất bình đẳng tài sản giữa các nhóm xã hội",
      ],
      opposition: [
        "Tài chính cá nhân nên được phụ huynh dạy trong bối cảnh gia đình",
        "Thêm môn bắt buộc làm chương trình học vốn đã nặng càng quá tải",
        "Khái niệm tài chính có thể quá trừu tượng để học sinh nhỏ áp dụng có ý nghĩa",
      ],
    },
  },
  "tech-01": {
    title: "Mạng xã hội gây hại nhiều hơn lợi cho thanh thiếu niên",
    context:
      "Nghiên cứu liên hệ việc dùng mạng xã hội nhiều với lo âu, trầm cảm và bắt nạt mạng ngày càng tăng ở thanh thiếu niên trên toàn cầu.",
    suggestedPoints: {
      proposition: [
        "Mạng xã hội góp phần gây lo âu, trầm cảm và hình ảnh bản thân tiêu cực",
        "Bắt nạt mạng trên các nền tảng gây tổn thương tâm lý lâu dài",
        "Thiết kế gây nghiện khai thác não bộ đang phát triển và làm giảm năng suất",
      ],
      opposition: [
        "Mạng xã hội giúp thanh thiếu niên xây cộng đồng và tìm mạng lưới hỗ trợ",
        "Nó mở ra nội dung giáo dục và nhiều góc nhìn đa dạng",
        "Vấn đề nằm ở cách dùng sai, không phải bản thân nền tảng; giải pháp là kỹ năng số",
      ],
    },
  },
  "tech-02": {
    title: "Trí tuệ nhân tạo sẽ thay thế phần lớn công việc của con người",
    context:
      "Tự động hóa bằng AI đang thay đổi các ngành từ sản xuất đến sáng tạo, đặt ra câu hỏi về tương lai việc làm của con người.",
    suggestedPoints: {
      proposition: [
        "AI có thể làm các nhiệm vụ nhận thức và thể chất lặp lại nhanh hơn, rẻ hơn con người",
        "Lịch sử cho thấy công nghệ thường xuyên thay thế toàn bộ nhóm nghề",
        "AI đang bước vào cả lĩnh vực sáng tạo và chuyên môn từng được xem là an toàn",
      ],
      opposition: [
        "AI tạo ra ngành nghề và loại công việc mới chưa từng tồn tại",
        "Kỹ năng con người như đồng cảm, sáng tạo và phán đoán vẫn không thể thay thế",
        "Các cuộc cách mạng công nghệ trước đây tạo ra nhiều việc làm hơn số việc mất đi",
      ],
    },
  },
  "tech-03": {
    title: "Nên cấm điện thoại thông minh trong trường học",
    context:
      "Một số quốc gia đã cấm điện thoại trong trường, với lý do cải thiện sự tập trung và tương tác xã hội của học sinh.",
    motionBrief: {
      keyTerms: [
        "điện thoại thông minh: điện thoại cá nhân có kết nối internet của học sinh",
        "cấm trong trường: không được dùng hoặc mang theo trong ngày học tại trường",
        "trường học: lớp học, giờ nghỉ và hoạt động do trường giám sát",
      ],
      scope:
        "Motion nói về điện thoại cá nhân của học sinh trong ngày học. Không cấm thiết bị do trường quản lý, ngoại lệ y tế, hỗ trợ khuyết tật hoặc liên lạc khẩn qua nhà trường.",
      propositionBurden:
        "Bảo vệ lệnh cấm trong ngày học và chứng minh nó cải thiện tập trung, học tập, an toàn hoặc sức khỏe tinh thần hơn cách quản lý có điều kiện.",
      oppositionBurden:
        "Chứng minh lệnh cấm toàn diện là không cần thiết hoặc gây hại, và quản lý/cách dùng có mục đích giải quyết xao nhãng với chi phí thấp hơn.",
      modelClarification:
        "Mô hình Ủng hộ nhất quán là cấm hoàn toàn điện thoại cá nhân của học sinh trong ngày học, chỉ có ngoại lệ hẹp cho y tế, tiếp cận khuyết tật hoặc khẩn cấp qua nhân viên trường.",
    },
    suggestedPoints: {
      proposition: [
        "Điện thoại là nguồn gây xao nhãng chính trong lớp học",
        "Lệnh cấm cải thiện tương tác trực tiếp trong giờ nghỉ",
        "Các trường cấm điện thoại ghi nhận kết quả học tập được cải thiện",
      ],
      opposition: [
        "Điện thoại là công cụ học tập hữu ích nếu dùng đúng cách",
        "Học sinh cần học tự điều chỉnh thay vì bị cấm toàn diện",
        "Điện thoại cần thiết cho an toàn và liên lạc với phụ huynh",
      ],
    },
  },
  "tech-04": {
    title: "Chính phủ nên quản lý các nền tảng mạng xã hội",
    context:
      "Các chính phủ đang tranh luận cách quản lý công ty công nghệ để bảo vệ người dùng mà vẫn giữ đổi mới và tự do ngôn luận.",
    suggestedPoints: {
      proposition: [
        "Các nền tảng đã thất bại trong tự kiểm soát tin giả và ngôn từ thù ghét",
        "Quyền riêng tư dữ liệu cần bảo vệ pháp lý mà chỉ chính phủ có thể thực thi",
        "Quản lý tạo trách nhiệm giải trình cho thuật toán gây hại cho thảo luận công",
      ],
      opposition: [
        "Quản lý của chính phủ có thể dẫn đến kiểm duyệt và bóp nghẹt biểu đạt",
        "Công nghệ thay đổi nhanh hơn luật, khiến quy định nhanh lỗi thời",
        "Quản lý quá mức có thể đẩy đổi mới sang các nước ít bị kiểm soát hơn",
      ],
    },
  },
  "tech-05": {
    title: "Công nghệ đang làm con người kém sáng tạo hơn",
    context:
      "Dù công nghệ cung cấp công cụ sáng tạo mạnh mẽ, nhiều người cho rằng nó khuyến khích tiêu thụ hơn sáng tạo và làm văn hóa trở nên đồng dạng.",
    suggestedPoints: {
      proposition: [
        "Tiêu thụ nội dung số liên tục khiến con người ít thời gian cho suy nghĩ độc đáo",
        "Nội dung do thuật toán dẫn dắt tạo buồng vang và xu hướng đồng dạng",
        "Văn hóa sao chép và dùng mẫu làm giảm nhu cầu sáng tạo nguyên bản",
      ],
      opposition: [
        "Công nghệ dân chủ hóa công cụ sáng tạo; ai cũng có thể làm nhạc, nghệ thuật hoặc phim",
        "Nền tảng số tạo ra hình thức nghệ thuật mới như nghệ thuật số, VR và remix",
        "Công cụ cộng tác cho phép hợp tác sáng tạo xuyên biên giới",
      ],
    },
  },
  "tech-06": {
    title: "Quyền riêng tư trực tuyến quan trọng hơn an ninh quốc gia",
    context:
      "Chính phủ cho rằng chương trình giám sát cần thiết cho an ninh, trong khi người bảo vệ quyền riêng tư cảnh báo nguy cơ lạm quyền.",
    suggestedPoints: {
      proposition: [
        "Giám sát đại trà xâm phạm quyền riêng tư cơ bản của con người",
        "Quyền giám sát của chính phủ thường bị lạm dụng cho mục đích chính trị",
        "Mã hóa mạnh và quyền riêng tư bảo vệ nhà báo, nhà hoạt động và nhóm thiểu số",
      ],
      opposition: [
        "Cơ quan tình báo cần truy cập dữ liệu để ngăn khủng bố và tội phạm mạng",
        "Công dân không có gì để giấu không nên sợ giám sát hợp lý",
        "Mối đe dọa an ninh quốc gia có thể gây hại lớn hơn nhiều so với giới hạn riêng tư",
      ],
    },
  },
  "soc-01": {
    title: "Nên hạ tuổi bầu cử xuống 16",
    context:
      "Một số quốc gia và thành phố đã hạ tuổi bầu cử xuống 16, cho rằng thanh thiếu niên đủ hiểu biết để tham gia dân chủ.",
    suggestedPoints: {
      proposition: [
        "Người 16 tuổi có thể đi làm, đóng thuế và chịu ảnh hưởng từ quyết định chính trị",
        "Bầu cử sớm tạo thói quen tham gia công dân lâu dài",
        "Người trẻ xứng đáng có tiếng nói trong vấn đề như biến đổi khí hậu ảnh hưởng tương lai họ",
      ],
      opposition: [
        "Phần lớn người 16 tuổi thiếu trải nghiệm sống để đưa ra quyết định chính trị chín chắn",
        "Nghiên cứu não bộ cho thấy vỏ não trước trán chưa trưởng thành đến khoảng 25 tuổi",
        "Thanh thiếu niên dễ bị thao túng chính trị và áp lực bạn bè hơn",
      ],
    },
  },
  "soc-02": {
    title: "Nên cấm thời trang nhanh",
    context:
      "Các thương hiệu thời trang nhanh sản xuất quần áo rẻ và theo xu hướng với chi phí môi trường và nhân quyền rất lớn, tạo ra hàng triệu tấn rác dệt may mỗi năm.",
    suggestedPoints: {
      proposition: [
        "Thời trang nhanh là một trong những ngành gây ô nhiễm hàng đầu thế giới",
        "Nó dựa vào lao động bị bóc lột ở các nước đang phát triển",
        "Cấm thời trang nhanh sẽ thúc đẩy đổi mới trong vật liệu bền vững",
      ],
      opposition: [
        "Quần áo giá rẻ rất cần thiết cho gia đình thu nhập thấp",
        "Lệnh cấm sẽ xóa bỏ hàng triệu việc làm sản xuất ở các nước đang phát triển",
        "Giáo dục người tiêu dùng và quản lý thực tế hơn cấm tuyệt đối",
      ],
    },
  },
  "soc-03": {
    title: "Giao thông công cộng nên miễn phí",
    context:
      "Một số thành phố thử miễn phí giao thông công cộng để giảm dùng xe cá nhân, giảm phát thải và tăng khả năng tiếp cận cho người thu nhập thấp.",
    suggestedPoints: {
      proposition: [
        "Giao thông miễn phí giảm ùn tắc và phát thải carbon",
        "Nó cải thiện khả năng di chuyển cho cộng đồng thu nhập thấp phụ thuộc vào phương tiện công cộng",
        "Lợi ích kinh tế từ di chuyển tốt hơn lớn hơn chi phí trợ giá",
      ],
      opposition: [
        "Giao thông miễn phí đòi hỏi tăng thuế lớn để vận hành",
        "Nó có thể gây quá tải và giảm chất lượng dịch vụ",
        "Doanh thu vé cần cho bảo trì và mở rộng hạ tầng",
      ],
    },
  },
  "soc-04": {
    title: "Nên cấm hoàn toàn thử nghiệm trên động vật",
    context:
      "Mỗi năm hơn 100 triệu động vật được dùng trong phòng thí nghiệm cho nghiên cứu y khoa, mỹ phẩm và an toàn sản phẩm.",
    suggestedPoints: {
      proposition: [
        "Động vật biết đau khổ và có quyền không bị dùng làm đối tượng thử nghiệm",
        "Các lựa chọn hiện đại như nuôi cấy tế bào và mô hình máy tính có thể thay thế",
        "Kết quả thử nghiệm trên động vật thường không chuyển hóa chính xác sang con người",
      ],
      opposition: [
        "Thử nghiệm động vật từng thiết yếu cho nhiều đột phá y học cứu người",
        "Các lựa chọn hiện tại chưa thể tái tạo đầy đủ hệ sinh học phức tạp",
        "Quy định nghiêm ngặt đã giảm thiểu đau khổ của động vật trong nghiên cứu",
      ],
    },
  },
  "soc-05": {
    title: "Phục vụ cộng đồng nên là điều kiện bắt buộc để tốt nghiệp",
    context:
      "Một số trường yêu cầu học sinh hoàn thành giờ phục vụ cộng đồng trước khi tốt nghiệp nhằm xây dựng trách nhiệm công dân và sự đồng cảm.",
    suggestedPoints: {
      proposition: [
        "Phục vụ cộng đồng phát triển đồng cảm và trách nhiệm xã hội",
        "Nó giúp học sinh tiếp xúc với cộng đồng đa dạng và vấn đề thực tế",
        "Yêu cầu bắt buộc tạo văn hóa đóng góp kéo dài sau khi rời trường",
      ],
      opposition: [
        "Tình nguyện bị ép buộc đi ngược tinh thần phục vụ cộng đồng chân thành",
        "Nó tạo thêm gánh nặng cho học sinh vốn đã quá tải học thuật",
        "Chất lượng phục vụ giảm khi học sinh chỉ làm để hoàn thành yêu cầu",
      ],
    },
  },
  "soc-06": {
    title: "Văn hóa tẩy chay gây hại nhiều hơn lợi",
    context:
      "Văn hóa tẩy chay là việc rút lại ủng hộ đối với người nổi tiếng hoặc nhân vật công chúng vì lời nói hay hành động bị cho là sai trái, thường qua chiến dịch mạng xã hội.",
    motionBrief: {
      keyTerms: [
        "văn hóa tẩy chay: chiến dịch công khai rút ủng hộ hoặc tạo hậu quả danh tiếng",
        "gây hại: trừng phạt bất công, tạo sợ hãi, phân cực hoặc mất đối thoại",
        "lợi ích: trách nhiệm giải trình, bảo vệ nạn nhân và thiết lập chuẩn mực xã hội",
      ],
      scope:
        "Tranh luận về các chiến dịch trách nhiệm giải trình không chính thức trên công chúng/mạng xã hội, không phải trừng phạt pháp lý hay phê bình cá nhân riêng tư.",
      propositionBurden:
        "Chứng minh tẩy chay thường tạo hậu quả quá mức, thiếu công bằng hoặc làm im lặng thảo luận nhiều hơn lợi ích trách nhiệm giải trình.",
      oppositionBurden:
        "Chứng minh áp lực công chúng là công cụ cần thiết khi hệ thống thất bại, nhất là cho nhóm yếu thế, và tác hại có thể được hạn chế.",
      modelClarification:
        "Giữ cuộc tranh luận ở mức so sánh tổng thể: motion hỏi thực hành xã hội này hại nhiều hơn lợi hay không, không phải mọi lời chỉ trích công khai đều sai.",
    },
    suggestedPoints: {
      proposition: [
        "Văn hóa tẩy chay bóp nghẹt tự do ngôn luận và đối thoại mở bằng không khí sợ hãi",
        "Nó thường thiếu quy trình công bằng và trừng phạt không tương xứng",
        "Nó cản trở sự trưởng thành và sửa sai khi định nghĩa con người mãi bằng lỗi lầm",
      ],
      opposition: [
        "Nó buộc người có quyền lực chịu trách nhiệm khi hệ thống truyền thống thất bại",
        "Cộng đồng yếu thế dùng nó để thách thức bất công hệ thống",
        "Chỉ trích công khai cũng là một hình thức tự do ngôn luận, không phải kiểm duyệt",
      ],
    },
  },
  "env-01": {
    title: "Năng lượng hạt nhân là giải pháp tốt nhất cho biến đổi khí hậu",
    context:
      "Điện hạt nhân tạo rất ít phát thải carbon nhưng gây lo ngại về an toàn, xử lý chất thải và nguy cơ tai nạn thảm khốc.",
    suggestedPoints: {
      proposition: [
        "Hạt nhân tạo sản lượng điện lớn với phát thải carbon gần như bằng không",
        "Nó cung cấp điện nền ổn định, khác với mặt trời và gió vốn gián đoạn",
        "Thiết kế lò phản ứng hiện đại an toàn hơn nhiều so với thế hệ cũ",
      ],
      opposition: [
        "Thảm họa như Chernobyl và Fukushima cho thấy rủi ro thảm khốc",
        "Chất thải phóng xạ nguy hiểm hàng nghìn năm mà chưa có giải pháp vĩnh viễn",
        "Năng lượng tái tạo kèm lưu trữ pin hiện rẻ hơn và triển khai nhanh hơn",
      ],
    },
  },
  "env-02": {
    title: "Hành động cá nhân có thể tạo tác động đáng kể đến biến đổi khí hậu",
    context:
      "Dù doanh nghiệp tạo phần lớn phát thải, cá nhân vẫn được khuyến khích giảm dấu chân carbon thông qua thay đổi lối sống.",
    suggestedPoints: {
      proposition: [
        "Lựa chọn tiêu dùng thúc đẩy hành vi doanh nghiệp; cầu giảm buộc họ thay đổi",
        "Hành động cá nhân như đổi chế độ ăn và giảm bay có tác động đo được",
        "Phong trào cơ sở bắt đầu từ cam kết cá nhân và truyền cảm hứng hành động tập thể",
      ],
      opposition: [
        "100 công ty chịu trách nhiệm 71% phát thải toàn cầu; hành động cá nhân là sự đánh lạc hướng",
        "Thay đổi hệ thống qua chính sách và quản lý có tác động lớn hơn nhiều",
        "Đổ trách nhiệm lên cá nhân giúp doanh nghiệp né tránh trách nhiệm",
      ],
    },
  },
  "env-03": {
    title: "Nên cấm hoàn toàn nhựa",
    context:
      "Hơn 300 triệu tấn nhựa được sản xuất mỗi năm, phần lớn kết thúc ở đại dương và bãi rác, mất hàng thế kỷ để phân hủy.",
    suggestedPoints: {
      proposition: [
        "Ô nhiễm nhựa đang phá hủy hệ sinh thái biển và đi vào chuỗi thức ăn",
        "Các lựa chọn bền vững như vật liệu phân hủy sinh học đã tồn tại",
        "Lệnh cấm sẽ buộc đổi mới trong bao bì và khoa học vật liệu",
      ],
      opposition: [
        "Nhựa thiết yếu trong thiết bị y tế, đồ bảo hộ và bảo quản thực phẩm",
        "Cấm hoàn toàn thiếu thực tế; giải pháp là hạ tầng tái chế tốt hơn",
        "Vật liệu thay thế thường có dấu chân carbon cao hơn trong sản xuất",
      ],
    },
  },
  "env-04": {
    title: "Các nước phát triển nên bồi thường khí hậu cho các nước đang phát triển",
    context:
      "Các nước đang phát triển chịu tác động nặng nhất của biến đổi khí hậu dù đóng góp ít nhất vào phát thải lịch sử, làm dấy lên yêu cầu công lý khí hậu.",
    suggestedPoints: {
      proposition: [
        "Các nước phát triển chịu trách nhiệm lịch sử cho phần lớn phát thải tích lũy",
        "Biến đổi khí hậu gây hại nặng cho các nước đang phát triển ít khả năng thích ứng",
        "Bồi thường sẽ tài trợ cho hạ tầng thích ứng và chuyển đổi xanh thiết yếu",
      ],
      opposition: [
        "Thế hệ hiện tại không nên trả cho phát thải lịch sử họ không gây ra",
        "Cơ chế bồi thường phức tạp, dễ tham nhũng và khó thực hiện công bằng",
        "Chuyển giao công nghệ và hợp tác thương mại hiệu quả hơn thanh toán trực tiếp",
      ],
    },
  },
  "env-05": {
    title: "Xe điện nên trở thành bắt buộc vào năm 2035",
    context:
      "Một số quốc gia đã công bố kế hoạch cấm bán xe động cơ đốt trong mới vào năm 2035, thúc đẩy chuyển đổi hoàn toàn sang xe điện.",
    suggestedPoints: {
      proposition: [
        "Giao thông là nguồn phát thải carbon lớn mà xe điện có thể cắt giảm mạnh",
        "Công nghệ xe điện đã đủ trưởng thành để phổ cập khi giá pin giảm",
        "Mốc thời gian rõ ràng thúc đẩy đầu tư ngành và hạ tầng",
      ],
      opposition: [
        "Hạ tầng xe điện chưa đủ ở nông thôn và vùng đang phát triển",
        "Sản xuất pin có lo ngại môi trường và đạo đức lớn liên quan đến khai khoáng",
        "Quy định bắt buộc tạo gánh nặng cho người thu nhập thấp không đủ tiền mua xe điện",
      ],
    },
  },
  "eth-01": {
    title: "Mục đích biện minh cho phương tiện",
    context:
      "Cuộc tranh luận triết học kinh điển này đặt chủ nghĩa hệ quả đối lập với đạo đức bổn phận, hỏi liệu kết quả có quyết định toàn bộ tính đạo đức của hành động hay không.",
    suggestedPoints: {
      proposition: [
        "Giá trị đạo đức nên được đo bằng kết quả và phúc lợi tổng thể tạo ra",
        "Quy tắc đạo đức cứng nhắc có thể dẫn đến kết quả tệ hơn khi áp dụng máy móc",
        "Quyết định đời thực luôn có đánh đổi giữa nguyên tắc và kết quả",
      ],
      opposition: [
        "Cho phép phương tiện vô đạo đức tạo tiền lệ nguy hiểm bất kể kết quả",
        "Ta không thể dự đoán kết quả đáng tin cậy, nên phải đánh giá hành động theo đạo đức nội tại",
        "Nhân quyền và phẩm giá không bao giờ được hy sinh cho tính toán lợi ích",
      ],
    },
  },
  "eth-02": {
    title: "Tự do ngôn luận không nên có bất kỳ giới hạn nào",
    context:
      "Tự do ngôn luận được xem là quyền cơ bản, nhưng tranh luận vẫn tiếp diễn về việc có nên hạn chế ngôn từ thù ghét, tin giả và kích động hay không.",
    suggestedPoints: {
      proposition: [
        "Mọi hạn chế ngôn luận đều tạo độ dốc trượt về kiểm duyệt",
        "Thị trường ý tưởng cần mọi quan điểm được lắng nghe và phản biện",
        "Không thể tin chính phủ quyết định phát ngôn nào được chấp nhận",
      ],
      opposition: [
        "Ngôn từ thù ghét và kích động bạo lực gây hại thật và đo lường được",
        "Ngôn luận không kiểm soát cho phép thế lực mạnh lan truyền tin giả nguy hiểm",
        "Phần lớn nền dân chủ cân bằng thành công giữa tự do biểu đạt và giới hạn hợp lý",
      ],
    },
  },
  "eth-03": {
    title: "Ăn thịt là có đạo đức",
    context:
      "Đạo đức của việc ăn thịt được tranh luận từ góc độ phúc lợi động vật, tác động môi trường, truyền thống văn hóa và nhu cầu dinh dưỡng.",
    suggestedPoints: {
      proposition: [
        "Con người tiến hóa như loài ăn tạp và thịt là một phần tự nhiên của chế độ ăn",
        "Chăn nuôi có đạo đức có thể bảo đảm phúc lợi động vật đồng thời cung cấp dinh dưỡng",
        "Ăn thịt gắn sâu với bản sắc văn hóa và truyền thống trên toàn thế giới",
      ],
      opposition: [
        "Động vật là sinh vật có cảm giác, biết đau khổ và xứng đáng được cân nhắc đạo đức",
        "Chế độ ăn thực vật có thể cung cấp dinh dưỡng đầy đủ mà không bóc lột động vật",
        "Sản xuất thịt là nguyên nhân lớn của phá rừng và phát thải khí nhà kính",
      ],
    },
  },
  "eth-04": {
    title: "Kiểm duyệt không bao giờ chính đáng trong nền dân chủ",
    context:
      "Dân chủ coi trọng tự do biểu đạt nhưng vẫn thường hạn chế nội dung liên quan đến an ninh quốc gia, an toàn công cộng hoặc nhóm dễ bị tổn thương.",
    suggestedPoints: {
      proposition: [
        "Kiểm duyệt mâu thuẫn căn bản với giá trị dân chủ của thảo luận mở",
        "Công dân cần tiếp cận mọi thông tin để đưa ra quyết định dân chủ sáng suốt",
        "Lịch sử cho thấy kiểm duyệt thường được dùng để đàn áp bất đồng và thiểu số",
      ],
      opposition: [
        "Bảo vệ an ninh quốc gia đôi khi cần hạn chế thông tin nhạy cảm",
        "Nội dung bóc lột trẻ em phải bị kiểm duyệt không ngoại lệ",
        "Dân chủ có trách nhiệm bảo vệ công dân khỏi tin giả nguy hại trong khủng hoảng",
      ],
    },
  },
  "eth-05": {
    title: "Bất tuân dân sự là một hình thức phản đối hợp lệ",
    context:
      "Từ Gandhi đến Martin Luther King Jr., bất tuân dân sự được dùng để thách thức luật bất công, nhưng người phản đối cho rằng nó làm suy yếu pháp quyền.",
    suggestedPoints: {
      proposition: [
        "Lịch sử cho thấy bất tuân dân sự thiết yếu để đạt công lý xã hội",
        "Khi kênh pháp lý thất bại, phá luật ôn hòa là lựa chọn cuối cho người bị áp bức",
        "Bất tuân dân sự thu hút chú ý công chúng đến bất công theo cách biểu tình hợp pháp không thể",
      ],
      opposition: [
        "Phá luật, dù vì lý do chính nghĩa, làm suy yếu khung pháp lý dân chủ",
        "Bất tuân dân sự có thể leo thang thành bạo lực và rối loạn công cộng",
        "Hệ thống dân chủ có cơ chế hợp pháp để thay đổi và cần dùng hết trước",
      ],
    },
  },
  "vn-01": {
    title: "Việt Nam nên áp dụng tuần làm việc 4 ngày",
    context:
      "Một số quốc gia đang thử tuần làm việc 4 ngày với kết quả tích cực, nhưng nền kinh tế đang phát triển của Việt Nam đặt ra câu hỏi về tính thực tế.",
    suggestedPoints: {
      proposition: [
        "Nghiên cứu cho thấy tuần 4 ngày tăng năng suất và giảm kiệt sức",
        "Lực lượng lao động trẻ của Việt Nam coi trọng cân bằng sống và làm việc, giúp thu hút nhân tài",
        "Giảm đi lại giúp giảm phát thải carbon và ùn tắc đô thị",
      ],
      opposition: [
        "Kinh tế Việt Nam vẫn đang phát triển và khó chịu được việc giảm giờ làm",
        "Nhiều ngành như sản xuất cần vận hành liên tục",
        "Áp lực cạnh tranh từ các nền kinh tế khu vực sẽ tăng nếu Việt Nam làm việc ít hơn",
      ],
    },
  },
  "vn-02": {
    title: "Học sinh Việt Nam chịu quá nhiều áp lực học tập",
    context:
      "Học sinh Việt Nam thường học thêm nhiều lớp ngoài giờ, với áp lực lớn để đạt kết quả cao trong các kỳ thi quốc gia.",
    suggestedPoints: {
      proposition: [
        "Áp lực quá mức gây vấn đề sức khỏe tinh thần, kiệt sức và mất tuổi thơ",
        "Tập trung vào điểm thi không phát triển kỹ năng mà nhà tuyển dụng hiện đại cần",
        "Các nước ít áp lực học tập hơn vẫn đạt kết quả giáo dục mạnh",
      ],
      opposition: [
        "Sự nghiêm túc học thuật đã thúc đẩy thành tựu giáo dục ấn tượng của Việt Nam",
        "Kỳ vọng cao thúc đẩy học sinh phát huy hết tiềm năng",
        "Áp lực phản ánh giá trị văn hóa coi trọng giáo dục đã giúp hàng triệu người thoát nghèo",
      ],
    },
  },
  "vn-03": {
    title: "Tiếng Anh nên trở thành ngôn ngữ chính thức thứ hai ở Việt Nam",
    context:
      "Việt Nam đầu tư mạnh vào giáo dục tiếng Anh, dạy tiếng Anh từ tiểu học, nhưng tiếng Anh chưa có địa vị ngôn ngữ chính thức.",
    suggestedPoints: {
      proposition: [
        "Địa vị chính thức cho tiếng Anh sẽ thúc đẩy Việt Nam hội nhập kinh tế toàn cầu",
        "Nó cải thiện khả năng tiếp cận giáo dục quốc tế và tài nguyên nghiên cứu",
        "Ngành công nghệ và du lịch đang phát triển của Việt Nam sẽ hưởng lợi rất lớn",
      ],
      opposition: [
        "Điều này có thể làm yếu vị thế tiếng Việt và bản sắc văn hóa",
        "Triển khai sẽ cực kỳ tốn kém và tạo bất bình đẳng thành thị - nông thôn",
        "Nhiều cường quốc kinh tế châu Á vẫn phát triển mà không biến tiếng Anh thành ngôn ngữ chính thức",
      ],
    },
  },
  "vn-04": {
    title: "Hệ thống giáo dục Việt Nam quá chú trọng học thuộc",
    context:
      "Dù Việt Nam đạt kết quả tốt trong các bài kiểm tra quốc tế, nhiều người cho rằng hệ thống giáo dục ưu tiên học vẹt hơn tư duy phản biện và sáng tạo.",
    motionBrief: {
      keyTerms: [
        "hệ thống giáo dục Việt Nam: giáo dục phổ thông và văn hóa thi cử chủ đạo",
        "học thuộc: ghi nhớ và lặp lại kiến thức mà thiếu áp dụng/phân tích",
        "quá chú trọng: sự cân bằng hiện tại lấn át tư duy phản biện, sáng tạo hoặc giải quyết vấn đề",
      ],
      scope:
        "Motion không nói học thuộc hoàn toàn vô giá trị. Nó hỏi liệu giáo dục Việt Nam hiện nay có đặt nặng ghi nhớ hơn mức hợp lý so với năng lực phân tích và sáng tạo hay không.",
      propositionBurden:
        "Chứng minh trọng tâm học thuộc hiện tại gây hại cụ thể cho kỹ năng, động lực hoặc khả năng thích ứng của học sinh.",
      oppositionBurden:
        "Chứng minh ghi nhớ là nền tảng cần thiết, hệ thống đang cải cách, hoặc tác hại đến từ áp lực khác chứ không phải bản thân việc ghi nhớ.",
      modelClarification:
        "Phe Ủng hộ nên lập luận về tái cân bằng đánh giá và phương pháp dạy học, không phải xóa bỏ toàn bộ việc ghi nhớ.",
    },
    suggestedPoints: {
      proposition: [
        "Học dựa trên ghi nhớ không chuẩn bị học sinh cho giải quyết vấn đề sáng tạo",
        "Nhà tuyển dụng thường nhận xét sinh viên tốt nghiệp thiếu tư duy phản biện",
        "Các nước nhấn mạnh kỹ năng phân tích thường nổi bật hơn về đổi mới và khởi nghiệp",
      ],
      opposition: [
        "Kiến thức nền tảng vững qua ghi nhớ là cần thiết trước khi tư duy bậc cao",
        "Điểm PISA của Việt Nam chứng minh hệ thống hiện tại hiệu quả theo chuẩn quốc tế",
        "Hệ thống đang hiện đại hóa với các cải cách chương trình gần đây",
      ],
    },
  },
  "vn-05": {
    title: "Du lịch gây hại nhiều hơn lợi cho văn hóa Việt Nam",
    context:
      "Ngành du lịch Việt Nam phát triển nhanh, mang lại lợi ích kinh tế nhưng cũng gây lo ngại về thương mại hóa văn hóa và tổn hại môi trường.",
    suggestedPoints: {
      proposition: [
        "Du lịch đại chúng thương mại hóa địa điểm linh thiêng và thực hành truyền thống",
        "Hạ tầng du lịch đẩy cộng đồng địa phương ra xa và làm tăng chi phí sống",
        "Tổn hại môi trường ở danh thắng như Vịnh Hạ Long đe dọa di sản",
      ],
      opposition: [
        "Du lịch mang lại thu nhập và việc làm thiết yếu cho hàng triệu người Việt",
        "Trao đổi văn hóa tăng sự trân trọng toàn cầu đối với truyền thống Việt Nam",
        "Doanh thu du lịch tài trợ bảo tồn di tích lịch sử và chương trình văn hóa",
      ],
    },
  },
};

export function getTopicStableKey(topic: DebateTopic) {
  return topic.topicKey ?? topic.id;
}

export function getTopicCategoryKey(topic: DebateTopic) {
  return topic.categoryKey && isCategoryKey(topic.categoryKey)
    ? topic.categoryKey
    : getCategoryKey(topic.category);
}

export function getLocalizedTopic(
  topic: DebateTopic,
  language: PracticeLanguage
): DebateTopic {
  const topicKey = getTopicStableKey(topic);
  const baseTopic = topics.find((candidate) => candidate.id === topicKey) ?? topic;
  const categoryKey = getTopicCategoryKey(baseTopic);
  const translation =
    language === "vi" ? VI_TOPIC_TRANSLATIONS[baseTopic.id] : null;

  return {
    ...baseTopic,
    topicKey,
    categoryKey,
    title: translation?.title ?? baseTopic.title,
    category: getCategoryLabel(categoryKey, language),
    context: translation?.context ?? baseTopic.context,
    motionBrief: translation?.motionBrief ?? baseTopic.motionBrief,
    suggestedPoints: translation?.suggestedPoints ?? baseTopic.suggestedPoints,
  };
}

export function getLocalizedTopics(language: PracticeLanguage): DebateTopic[] {
  return topics.map((topic) => getLocalizedTopic(topic, language));
}

export function getTopicByKey(topicKey: string | null | undefined) {
  if (!topicKey) return undefined;
  return topics.find((topic) => topic.id === topicKey || topic.topicKey === topicKey);
}
