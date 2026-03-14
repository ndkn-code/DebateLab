import type { DebateTopic } from "@/types";

export const CATEGORIES = [
  "Education & School Life",
  "Technology & Social Media",
  "Society & Culture",
  "Environment & Sustainability",
  "Ethics & Philosophy",
  "Vietnam-Specific Issues",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const topics: DebateTopic[] = [
  // ── Education & School Life ──────────────────────────────────────
  {
    id: "edu-01",
    title: "Homework should be abolished in high schools",
    category: "Education & School Life",
    difficulty: "beginner",
    context:
      "Many educators debate whether homework improves learning outcomes or simply adds unnecessary stress to students' lives.",
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
