/**
 * Format-showcase Academic mock — original content exercising every
 * objective question format plus Writing/Speaking prompt shapes.
 *
 * Listening 40 Q (4 parts), Reading 40 Q (3 passages), Writing 2, Speaking 9.
 */
import type {
  AuthoredBankOption,
  AuthoredGroup,
  AuthoredListeningSection,
  AuthoredPassage,
  AuthoredQuestion,
  AuthoredTest,
} from "./types";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix"] as const;

function letterOptions(texts: string[]): AuthoredBankOption[] {
  return texts.map((text, i) => ({ id: LETTERS[i], label: LETTERS[i], text }));
}

function romanOptions(texts: string[]): AuthoredBankOption[] {
  return texts.map((text, i) => ({ id: ROMAN[i], label: ROMAN[i], text }));
}

/* ------------------------------------------------------------------ */
/* Listening scripts                                                   */
/* ------------------------------------------------------------------ */

const L1_SCRIPT = `Narrator: You will hear a man telephoning an arts centre to enrol on an evening course.
Receptionist: Good afternoon, Hollins Arts Centre. How can I help?
Daniel: Oh, hello. I'd like to enrol on one of your pottery evening courses, if there are still places.
Receptionist: There are, yes. Let me take a few details. Can I have your name?
Daniel: It's Daniel Kovacs.
Receptionist: Could you spell the surname for me?
Daniel: Of course. K-O-V-A-C-S.
Receptionist: K-O-V-A-C-S. Thank you. And which level? We run beginners, intermediate and advanced.
Daniel: I did a short course a couple of years ago, so I think intermediate would suit me better than beginners.
Receptionist: Intermediate, fine. And a contact number, in case a session has to be cancelled?
Daniel: My mobile is 07700 900431.
Receptionist: 07700 900431. Lovely. Now, a few practical things. You'll need to bring an apron, because the clay gets everywhere. Old clothes are fine too, but the apron is essential.
Daniel: An apron. Noted. When does the course actually start?
Receptionist: The intermediate group begins on the third of March. Not February, as it says on the old leaflet, I'm afraid. We had to push it back.
Daniel: The third of March. And how much is it?
Receptionist: It's eighty-five pounds for the whole course. It was ninety last year, but we've managed to bring it down a little.
Daniel: Eighty-five. That's reasonable. And how many sessions is that?
Receptionist: Six sessions, each two hours long. We used to run eight, but the tutor found that six worked better for people with jobs.
Daniel: Six, right. Do I need to buy my own tools?
Receptionist: Not at all. The studio has a box of second-hand tools that you can use free of charge, and if you want your own set later, the tutor can advise you.
Daniel: Great. And where exactly is the class held? I've only ever been to the main hall.
Receptionist: It's in the basement, directly under the main hall. Take the stairs by the ticket desk.
Daniel: The basement. Is there anywhere to park?
Receptionist: Our own car park is very small, so we ask evening students to park behind the library across the road. It's free after six.
Daniel: Behind the library. Perfect. Thank you very much.
Receptionist: You're welcome. I'll email you the confirmation this afternoon.`;

const L2_SCRIPT = `Narrator: You will hear a guide giving an orientation talk at Alder Bank sports park.
Guide: Good morning, everyone, and welcome to Alder Bank. Before we walk round, let me describe the layout using the map on your leaflet. We're at the main entrance on the south side. The river runs along the northern edge, the lake is on the east side, and a path loops right round the park.
Guide: Straight ahead of you, just inside the gate, is the café. It used to be by the lake, but it moved into the new building last spring. The changing rooms are also close to the entrance: as you come in, they're immediately on your left, in the long single-storey block.
Guide: If you follow the path up the west side, about halfway along you'll come to the bike hire hut. You'll need photo identification to hire one. Carry on to the north-west corner, right beside the river, and you'll find the picnic area under the trees, with tables and two barbecue stands.
Guide: In the centre of the park, where the two cross-paths meet, there's a small round building. That's the first-aid point. It's staffed at weekends, and there's an emergency phone on the outside wall. Finally, if you walk along the river towards the lake, in the north-east corner you'll see a tall grey tower. That's the climbing wall, which opened in June.
Guide: A few rules. The tennis courts are very popular, so they must be booked online at least a day ahead; you can no longer just turn up and pay at the kiosk. The gates close at ten in summer, but from November to March we close at eight, because the paths aren't lit. What's new this year is the outdoor gym beside the running track; it's free and open whenever the park is. And please, no swimming in the lake. It's deep and cold, and we've had to rescue people. Boats are fine, and you can fish with a permit from the office. Right, shall we start?`;

const L3_SCRIPT = `Narrator: You will hear two students, Priya and Tomas, discussing their fieldwork project with their tutor.
Tutor: So, you ran the pilot survey on the stream last week. How did it go?
Priya: Mixed, honestly. The weather was fine, which we'd been worried about, and the site was easy enough to get to. But we only managed twelve samples in the whole afternoon, and that's really too few to say anything.
Tomas: And the recording sheets we designed were a mess. We had three different columns for the same thing, so half the time we didn't know where to write a number. We'll have to redesign them.
Tutor: Those are useful lessons. Nothing broke?
Tomas: No, the equipment was all fine.
Tutor: Good. Now, for the main study I'd suggest two changes. First, use the standard sampling net from the store rather than the one you made. It's the size everyone else uses, so your results can be compared with other surveys.
Priya: That makes sense.
Tutor: Second, add a second site further downstream, below the farm. Then you have a comparison, and that's what turns a description into an argument.
Tomas: Should we photograph every sample as well?
Tutor: You can, but it's optional. And before you ask, no, I can't extend the deadline by a week.
Priya: We'll manage. The field centre has said we can use their facilities. We'll sort the samples in the laboratory, because it has the microscopes, and we'll use the library for the identification guides.
Tomas: They offered us the lecture hall too, but we don't need it.
Tutor: Fine. Who's doing what?
Priya: I'll write the risk assessment, since I did one last year.
Tomas: I'll book the minibus. I've already spoken to the transport office.
Tutor: And identifying the specimens?
Priya: We'll do that together. Neither of us is confident enough to do it alone.
Tomas: And we'll both prepare the poster for the presentation, since it needs the maps and the data.
Tutor: Sounds like a plan. Come back to me when the second site is sorted.`;

const L4_SCRIPT = `Narrator: You will hear part of a lecture about cool roofs and city temperatures.
Lecturer: Today I want to talk about one of the simplest ways a city can lower street temperatures: the cool roof. Cities are hotter than the countryside around them because dark surfaces, especially roads and roofs, absorb sunlight and release it as heat. A dark roof on a summer afternoon can reach seventy degrees. A cool roof reflects most of that sunlight instead.
Lecturer: The idea isn't new. Early cool roofs were simply covered in white paint. Any reflective paint does the job, but it wears away quickly. Modern coatings are more durable and can be light grey or even pale colours, as long as they reflect well.
Lecturer: Let me describe the procedure we followed in our own project. First, we record the roof-top temperature before any work begins, using an infrared sensor, so that we have a baseline. Next, the surface is cleaned and any cracks are sealed, because coating a cracked roof simply hides the damage. Then the reflective coating goes on: two coats, allowing the first to dry completely before the second. After that, the coating is inspected every six months for dirt and wear, since a dirty roof reflects far less. And finally, the temperature readings are reported to the city database, so results from many buildings can be compared.
Lecturer: Our first study was of a warehouse on the edge of the city, a large, flat, single-storey building, which is the ideal case. We monitored it for a year. The largest energy saving was in summer, as you would expect, when the air conditioning was working hardest. Over that summer, cooling costs fell by fifteen percent, which for a building of that size is a considerable sum.
Lecturer: There are drawbacks. A very white roof can produce glare for people in taller buildings nearby, and in cold climates a reflective roof slightly increases heating demand in winter. Some cities prefer green roofs, which are covered in vegetation. These cool the building too, and also reduce rainwater run-off, though they are heavier and more expensive.`;

const listeningSections: AuthoredListeningSection[] = [
  {
    importId: "fsa-l1",
    sectionNumber: 1,
    title: "Enrolling on a pottery evening course",
    script: L1_SCRIPT,
    accent: "uk",
    speakers: [
      { name: "Receptionist", accent: "uk" },
      { name: "Daniel", accent: "uk" },
    ],
  },
  {
    importId: "fsa-l2",
    sectionNumber: 2,
    title: "Orientation walk around Alder Bank sports park",
    script: L2_SCRIPT,
    accent: "us",
    speakers: [{ name: "Guide", accent: "us" }],
  },
  {
    importId: "fsa-l3",
    sectionNumber: 3,
    title: "Planning a fieldwork project",
    script: L3_SCRIPT,
    accent: "uk",
    speakers: [
      { name: "Tutor", accent: "uk" },
      { name: "Priya", accent: "uk" },
      { name: "Tomas", accent: "us" },
    ],
  },
  {
    importId: "fsa-l4",
    sectionNumber: 4,
    title: "Cool roofs: how cities lower street temperature",
    script: L4_SCRIPT,
    accent: "us",
    speakers: [{ name: "Lecturer", accent: "us" }],
  },
];

/* ------------------------------------------------------------------ */
/* Reading passages                                                    */
/* ------------------------------------------------------------------ */

const R1_BODY = `A
For most of the twentieth century, the response to a coastline under attack was to build something hard. Concrete sea walls, rock armour and timber groynes were placed in front of towns and farmland, and for a while they held the sea back. Yet engineers have gradually come to recognise that the cheapest and most durable defence on many sandy shores was there all along. A healthy dune system absorbs the energy of storm waves, stores sand that can be released onto the beach after a rough winter, and repairs itself at no cost. It also shelters a distinctive community of plants, insects and ground-nesting birds. Where the dunes are wide enough, the pools that form between the ridges support amphibians and rare orchids that survive almost nowhere else. A recent review of coastal schemes in northern Europe estimated that maintaining dunes costs less than a tenth of what it costs to maintain a comparable length of sea wall over fifty years.

B
Dunes are lost for several reasons, and rarely because of a single storm. The most common cause is simply feet. A path worn through the vegetation exposes bare sand, the wind enlarges the gap into what is known as a blow-out, and within a few seasons a broad channel has opened through which the sea can pour. Building on the dunes, or immediately behind them, is a second problem, because it removes the space into which they would naturally shift. A third cause is less visible: harbour walls and breakwaters built many kilometres away can interrupt the flow of sand along the coast, so that a beach is slowly starved of the material it needs to rebuild after each winter.

C
Restoration usually begins with the simplest of tools. Rows of wooden fences, made from slats or brushwood, are set across the beach at right angles to the prevailing wind. The fences do not stop the wind; they slow it, and as the air loses speed it drops the sand it is carrying. A ridge forms on the sheltered side of each fence, and once it has reached the top of the slats a second row is added. The materials are cheap, and the work can be done by a small team in a few days, which is why the technique has changed little in a century. Where fences have been maintained carefully, a new foredune roughly a metre high typically forms within three years, though the time varies with the strength of the wind and the supply of sand on the beach.

D
Sand alone will not hold. The next step is to plant marram grass, a coarse, grey-green species found on dunes across Europe and introduced to many other coasts. Marram is remarkable because it is stimulated rather than harmed by being buried. Each time sand covers the plant, it sends up new shoots and pushes out further roots, so that a single clump can build a dense network several metres deep. Volunteers plant the grass in the autumn and spring, in staggered rows about half a metre apart, and by the time it is established the fences are half buried and quietly rotting away.

E
None of this works if people keep walking over it. Restoration projects therefore spend as much on managing visitors as on moving sand. Boardwalks are laid along the routes people already use, since experience shows that closing a path entirely simply creates a new one beside it. Temporary fencing marks the planted areas, and signs explain what is happening and why. Dogs are a particular difficulty, since they ignore signs, and some projects now ask owners to keep them on a lead during the nesting season. Several projects have found that recruiting local residents as volunteers changes attitudes more effectively than any sign: people who have planted a section of dune tend to guard it.

F
Even a well-restored dune has limits. Dunes are not fixed objects but moving ones, and a system that is prevented from rolling slowly inland will eventually be cut away at the front. Planners are now more willing to leave a strip of undeveloped land behind the dunes, and in a few places roads and car parks have been deliberately moved back to make room. Regular monitoring, using drones and simple survey posts, allows managers to see where a dune is losing height and act before a blow-out becomes a breach. The lesson of the past few decades is that dunes can be rebuilt, but only if they are given space and time.`;

const R2_BODY = `A
Long-distance footpaths, routes of a hundred kilometres or more that are intended to be walked over days rather than hours, are among the most popular recreational facilities a country can provide, and among the cheapest. Yet surprisingly little was written about how to design one until recently. Most of the classic routes were laid out by enthusiasts who simply joined existing tracks together and hoped for the best. Some became famous. Others were opened with speeches and signposts and then quietly forgotten.

B
The difference between the two, according to the geographer Helen Marsh, has less to do with scenery than with rhythm. Marsh spent two years interviewing walkers on six routes and found that the quality they valued most was not distance, or even dramatic views, but change: a route that moved from woodland to open moor to river valley within a single day was rated far more highly than one that offered a spectacular but unchanging landscape. People remember a walk as a sequence, she argues, and if every hour looks the same, the day collapses into one long hour.

C
The landscape planner Ravi Anand approaches the problem from the ground up, quite literally. His work concerns the surface of the path itself, and his central point is that there is no single correct one. A stone-pitched path that survives thousands of boots a week on a mountain would feel oppressive on a quiet lowland route, while a grass track that is charming for a hundred walkers a year turns into a muddy trench for ten thousand. Anand's team now models expected footfall for each section of a proposed route before choosing materials, and he is critical of designers who apply one standard everywhere. He points out that a surface which is wrong for its traffic does not merely look out of place: it fails, and the cost of repairing it is far greater than the cost of choosing correctly at the start.

D
Both researchers agree on one principle: keep walkers off roads. It is not only a question of safety, though that matters. Marsh's interviews show that even short sections along a road break the sense of being on a journey, and walkers tend to describe a route by its worst kilometre rather than its best. Where a road cannot be avoided, designers now try to cross it at a single point rather than follow it, and to hide the crossing behind a hedge or a bend so that the walker is not looking at traffic for long.

E
Waymarking, the small signs and painted marks that keep walkers on the route, turns out to be harder to get right than anyone expected. Too few marks and people get lost; too many and something is lost as well. Anand has argued that over-signing removes the mild uncertainty that makes a long walk feel like an adventure, and his team now tests a proposed scheme by sending volunteers unfamiliar with the area along the route with no map, recording every point at which they hesitate for more than a few seconds. Marks are added only where hesitation occurs.

F
Then there is money. The economist Ingrid Sol has studied the spending of walkers on three routes and reached a conclusion that has changed how paths are planned. Walkers, she found, spend most of their money where they stop for the night, and they stop where the route happens to pass. A route that skirts around villages to stay in open country may be prettier, but it sends almost nothing into the local economy. A route that passes through the middle of a small settlement every fifteen to twenty kilometres supports shops, cafés and guesthouses that could not survive on residents alone. Sol's figures suggest that a popular route can be worth several million pounds a year to the communities along it, and that most of that value is created by the placing of the path, not by advertising. She is careful to add that the effect depends on the route being walked in one direction by most people, so that the same villages receive a steady stream of overnight guests.

G
Not everyone welcomes a path. Landowners along a proposed route are often divided: some see customers and some see litter, gates left open and dogs among livestock. Negotiating access can take longer than building the route, and several projects have stalled for years over a single field. The routes that succeed, all three researchers agree, are those that were planned with the people who live along them rather than presented to them. A well-known coastal path in the north now attracts around 250,000 walkers a year, but its planners spent almost a decade in discussion before the first signpost went in. A rival inland route, opened in the same year with far less consultation, has never recorded more than a few hundred walkers annually, and parts of it are now impassable.`;

const R3_BODY = `Walk through the centre of almost any city after midnight and you will find it lit as brightly as a stage. Shop windows glow for customers who went home hours ago; office towers blaze on every floor; streetlights pour their orange or bluish light onto empty pavements. We have come to regard this as normal, even as a sign of prosperity. It is worth asking how we got here, and whether we want to stay.

Public lighting is older than most people assume, but its purpose has changed. The first gas lamps installed in European cities in the early nineteenth century were paid for largely by traders, and their aim was commercial: they allowed shops to stay open after dark and extended the working day of the streets. The association between lighting and safety came later, and it came mainly from the companies selling the lamps. By the twentieth century the idea that a brighter street was a safer street had hardened into common sense, and councils competed to install more powerful lamps.

The evidence for that common sense is thinner than its popularity suggests. Reviews of dozens of studies have found that improved lighting sometimes reduces crime, sometimes has no measurable effect, and occasionally seems to increase it, perhaps because a well-lit street draws more people, and more potential victims, into it. Where lighting does help, the effect appears to come less from visibility than from the signal it sends: a cared-for street. That is not nothing, but it is not the same as the claim, still repeated in council meetings, that darkness is dangerous in itself.

Meanwhile the costs of light have become harder to ignore. Street lighting is typically the largest single item on a council's electricity bill. Astronomers have complained for decades that the night sky is disappearing; in many cities fewer than a dozen stars are visible on a clear night. Biologists have added a longer list. Migrating birds are drawn off course by lit towers; insects circle lamps until they die; trees near streetlights keep their leaves for weeks longer in autumn, which damages them. Coastal turtles, which hatch at night and find the sea by its faint glow, crawl instead towards hotels. And humans are animals too. The switch from older orange lamps to white LEDs has saved energy, but the blue-rich light of many LEDs suppresses the hormone that prepares the body for sleep, and residents of newly lit streets report sleeping worse.

None of this means switching everything off. The experiment has, in fact, been tried. Faced with rising bills, a number of towns in the north of England began turning some streetlights off between midnight and five in the morning, or dimming them by half. The response was loud: residents predicted a wave of burglaries and accidents. A study that followed several years of data from these areas found nothing of the kind. Night-time road accidents did not rise on the dimmed or switched-off streets, and neither did recorded crime. What had changed was mainly the electricity bill, which fell sharply. Some councils have since restored lighting on particular streets in response to local pressure, but none has returned to full lighting everywhere.

The interesting conclusion is not that darkness is harmless but that most of the light we produce is wasted. A conventional streetlamp throws a large share of its output sideways and upwards, into bedroom windows and the sky, where it does no good to anyone. The technical fix is old and simple: a shield, or hood, fitted above the lamp so that light is directed downwards onto the road and pavement. Full cut-off fittings of this kind cost little more than standard ones, and because none of the light is wasted, a less powerful lamp can be used.

Adaptive lighting takes the idea further. Each lamp carries a light sensor that switches it on only when natural light has faded, and a controller that dims it in the small hours and brings it back to full strength when a pedestrian or cyclist approaches. Because the lamps are networked, a fault is reported automatically instead of waiting for a resident to complain. Trials in several European cities have cut lighting energy use by more than half without residents noticing much difference, except that the sky above them has become slightly darker and, on a clear night, slightly more interesting.

I am not arguing for an unlit city; that would be as thoughtless as the over-lit one we have now. I am arguing that light, like water or heat, is something to be directed where it is needed and withheld where it is not. The question for a council is not how bright, but for whom, and when. A street empty at three in the morning does not need to be lit as if it were a football stadium. A pedestrian crossing does. A park path used by people walking home from a late shift deserves better than either. Once lighting is treated as a service to people rather than a display of civic confidence, the answers become obvious, and cheaper.`;

const passages: AuthoredPassage[] = [
  { importId: "fsa-r1", orderIndex: 0, title: "Rebuilding sand dunes", body: R1_BODY, genre: "environment" },
  { importId: "fsa-r2", orderIndex: 1, title: "Designing long-distance footpaths", body: R2_BODY, genre: "leisure_planning" },
  { importId: "fsa-r3", orderIndex: 2, title: "Should cities go dark? Light at night", body: R3_BODY, genre: "science_society" },
];

/* ------------------------------------------------------------------ */
/* Groups                                                              */
/* ------------------------------------------------------------------ */

const groups: AuthoredGroup[] = [
  /* Listening Part 1 */
  {
    importId: "fsa-g-l1-form",
    groupKey: "l1-form",
    skill: "listening",
    sectionImportId: "fsa-l1",
    orderIndex: 0,
    title: "Questions 1–10",
    instructions: "Complete the form below. Write ONE WORD AND/OR A NUMBER for each answer.",
    answerMode: "text",
    stimulus: {
      kind: "table",
      caption: "Hollins Arts Centre – Evening Course Enrolment",
      headers: ["Field", "Details"],
      rows: [
        ["Name", "Example: Daniel"],
        ["Surname", { gap: "1" }],
        ["Course level", { gap: "2" }],
        ["Phone", { gap: "3" }],
        ["Bring", { gap: "4" }],
        ["Start date", { gap: "5" }],
        ["Fee (£)", { gap: "6" }],
        ["Number of sessions", { gap: "7" }],
        ["Tools available free", { gap: "8", label: "… tools" }],
        ["Room", { gap: "9" }],
        ["Parking", { gap: "10", label: "behind the …" }],
      ],
    },
  },
  /* Listening Part 2 */
  {
    importId: "fsa-g-l2-map",
    groupKey: "l2-map",
    skill: "listening",
    sectionImportId: "fsa-l2",
    orderIndex: 1,
    title: "Questions 11–16",
    instructions: "Label the map below. Write the correct letter, A–H, next to Questions 11–16.",
    answerMode: "select",
    bankReuse: false,
    bank: letterOptions([
      "just inside the entrance, on the left",
      "just inside the entrance, straight ahead",
      "on the west side of the loop path",
      "north-west corner, beside the river",
      "north side, in the middle, beside the river",
      "north-east corner, beside the river",
      "south of the lake",
      "in the centre of the park",
    ]),
    stimulus: {
      kind: "image",
      assetImportId: "map-alder-bank",
      alt: "Plan of Alder Bank sports park showing the entrance at the south, a river along the north edge, a lake on the east side, a looping path and eight lettered squares A to H.",
      caption: "Alder Bank sports park",
      hotspots: [
        { slot: "11", x: 82, y: 30, label: "11" },
        { slot: "12", x: 82, y: 38, label: "12" },
        { slot: "13", x: 82, y: 46, label: "13" },
        { slot: "14", x: 82, y: 54, label: "14" },
        { slot: "15", x: 82, y: 62, label: "15" },
        { slot: "16", x: 82, y: 70, label: "16" },
      ],
    },
  },
  {
    importId: "fsa-g-l2-mcq",
    groupKey: "l2-mcq",
    skill: "listening",
    sectionImportId: "fsa-l2",
    orderIndex: 2,
    title: "Questions 17–20",
    instructions: "Choose the correct letter, A, B or C.",
    answerMode: "select",
  },
  /* Listening Part 3 */
  {
    importId: "fsa-g-l3-multi-a",
    groupKey: "l3-multi-a",
    skill: "listening",
    sectionImportId: "fsa-l3",
    orderIndex: 3,
    title: "Questions 21 and 22",
    instructions: "Choose TWO letters, A–E.",
    answerMode: "select",
  },
  {
    importId: "fsa-g-l3-multi-b",
    groupKey: "l3-multi-b",
    skill: "listening",
    sectionImportId: "fsa-l3",
    orderIndex: 4,
    title: "Questions 23 and 24",
    instructions: "Choose TWO letters, A–E.",
    answerMode: "select",
  },
  {
    importId: "fsa-g-l3-any",
    groupKey: "l3-any",
    skill: "listening",
    sectionImportId: "fsa-l3",
    orderIndex: 5,
    title: "Questions 25 and 26",
    instructions:
      "Which TWO facilities at the field centre will the students use? Write ONE WORD for each answer. You may write the answers in any order.",
    answerMode: "text",
    anyOrder: true,
  },
  {
    importId: "fsa-g-l3-features",
    groupKey: "l3-features",
    skill: "listening",
    sectionImportId: "fsa-l3",
    orderIndex: 6,
    title: "Questions 27–30",
    instructions:
      "Who will be responsible for each of the following tasks? Write the correct letter, A, B or C, next to Questions 27–30. NB You may use any letter more than once.",
    answerMode: "select",
    bankReuse: true,
    bank: letterOptions(["Priya", "Tomas", "both Priya and Tomas"]),
  },
  /* Listening Part 4 */
  {
    importId: "fsa-g-l4-flow",
    groupKey: "l4-flow",
    skill: "listening",
    sectionImportId: "fsa-l4",
    orderIndex: 7,
    title: "Questions 31–34",
    instructions: "Complete the flow chart below. Write NO MORE THAN TWO WORDS for each answer.",
    answerMode: "text",
    stimulus: {
      kind: "flowchart",
      title: "Installing and monitoring a cool roof",
      direction: "down",
      steps: [
        { text: "Record the __BLANK_31__ temperature before work begins, using an infrared sensor." },
        { text: "Clean the surface and seal any __BLANK_32__." },
        { text: "Apply __BLANK_33__ of reflective coating, letting the first dry completely." },
        { text: "Inspect the coating every __BLANK_34__ for dirt and wear." },
        { text: "Report the temperature readings to the city database." },
      ],
    },
  },
  {
    importId: "fsa-g-l4-sentence",
    groupKey: "l4-sentence",
    skill: "listening",
    sectionImportId: "fsa-l4",
    orderIndex: 8,
    title: "Questions 35–37",
    instructions: "Complete the sentences below. Write NO MORE THAN TWO WORDS for each answer.",
    answerMode: "text",
  },
  {
    importId: "fsa-g-l4-short",
    groupKey: "l4-short",
    skill: "listening",
    sectionImportId: "fsa-l4",
    orderIndex: 9,
    title: "Questions 38–40",
    instructions: "Answer the questions below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.",
    answerMode: "text",
  },

  /* Reading Passage 1 */
  {
    importId: "fsa-g-r1-headings",
    groupKey: "r1-headings",
    skill: "reading",
    passageImportId: "fsa-r1",
    orderIndex: 10,
    title: "Questions 1–6",
    instructions:
      "Reading Passage 1 has six paragraphs, A–F. Choose the correct heading for each paragraph from the list of headings below. Write the correct number, i–ix, next to Questions 1–6.",
    answerMode: "select",
    bankReuse: false,
    bank: romanOptions([
      "A natural barrier that pays for itself",
      "Why dunes disappear",
      "Trapping sand with simple structures",
      "A plant that thrives on burial",
      "Keeping visitors on the right track",
      "Room to move: the long-term view",
      "The rising cost of concrete sea walls",
      "Wildlife returns to restored dunes",
      "How storms create new beaches",
    ]),
  },
  {
    importId: "fsa-g-r1-tfng",
    groupKey: "r1-tfng",
    skill: "reading",
    passageImportId: "fsa-r1",
    orderIndex: 11,
    title: "Questions 7–10",
    instructions:
      "Do the following statements agree with the information given in Reading Passage 1? Write TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, or NOT GIVEN if there is no information on this.",
    answerMode: "select",
  },
  {
    importId: "fsa-g-r1-notes",
    groupKey: "r1-notes",
    skill: "reading",
    passageImportId: "fsa-r1",
    orderIndex: 12,
    title: "Questions 11–13",
    instructions: "Complete the notes below. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
    answerMode: "text",
    stimulus: {
      kind: "text",
      heading: "Restoring a dune",
      body: "• Rows of __BLANK_11__ are placed across the beach to slow the wind and trap sand.\n• A new foredune about a metre high normally forms within __BLANK_12__.\n• __BLANK_13__ is then planted, because being buried makes it grow more.\n• Boardwalks and temporary fencing keep visitors off the planted areas.",
    },
  },

  /* Reading Passage 2 */
  {
    importId: "fsa-g-r2-info",
    groupKey: "r2-info",
    skill: "reading",
    passageImportId: "fsa-r2",
    orderIndex: 13,
    title: "Questions 14–18",
    instructions:
      "Reading Passage 2 has seven paragraphs, A–G. Which paragraph contains the following information? Write the correct letter, A–G, next to Questions 14–18. NB You may use any letter more than once.",
    answerMode: "select",
    bankReuse: true,
    bank: letterOptions(["Paragraph A", "Paragraph B", "Paragraph C", "Paragraph D", "Paragraph E", "Paragraph F", "Paragraph G"]),
  },
  {
    importId: "fsa-g-r2-features",
    groupKey: "r2-features",
    skill: "reading",
    passageImportId: "fsa-r2",
    orderIndex: 14,
    title: "Questions 19–22",
    instructions:
      "Look at the following statements and the list of researchers below. Match each statement with the correct researcher, A, B or C. Write the correct letter, A, B or C, next to Questions 19–22. NB You may use any letter more than once.",
    answerMode: "select",
    bankReuse: true,
    bank: letterOptions(["Helen Marsh", "Ravi Anand", "Ingrid Sol"]),
  },
  {
    importId: "fsa-g-r2-summary",
    groupKey: "r2-summary",
    skill: "reading",
    passageImportId: "fsa-r2",
    orderIndex: 15,
    title: "Questions 23–26",
    instructions:
      "Complete the summary using the list of words, A–H, below. Write the correct letter, A–H, next to Questions 23–26.",
    answerMode: "select",
    bankReuse: false,
    bank: letterOptions(["villages", "surface", "signs", "roads", "maintenance", "variety", "safety", "erosion"]),
    stimulus: {
      kind: "text",
      heading: "Designing a route",
      body: "Researchers agree that a long-distance path should avoid __BLANK_23__ as far as possible, since even short stretches spoil the feeling of a journey. Marsh's interviews suggest that walkers value __BLANK_24__ more than distance or dramatic views, while Anand argues that the __BLANK_25__ of a path should depend on how many people are expected to use it. Sol's research shows that a route which passes through __BLANK_26__ brings far more money to local communities.",
    },
  },

  /* Reading Passage 3 */
  {
    importId: "fsa-g-r3-ynng",
    groupKey: "r3-ynng",
    skill: "reading",
    passageImportId: "fsa-r3",
    orderIndex: 16,
    title: "Questions 27–31",
    instructions:
      "Do the following statements agree with the claims of the writer in Reading Passage 3? Write YES if the statement agrees with the claims of the writer, NO if the statement contradicts the claims of the writer, or NOT GIVEN if it is impossible to say what the writer thinks about this.",
    answerMode: "select",
  },
  {
    importId: "fsa-g-r3-endings",
    groupKey: "r3-endings",
    skill: "reading",
    passageImportId: "fsa-r3",
    orderIndex: 17,
    title: "Questions 32–35",
    instructions: "Complete each sentence with the correct ending, A–G, below. Write the correct letter, A–G, next to Questions 32–35.",
    answerMode: "select",
    bankReuse: false,
    bank: letterOptions([
      "shops could trade after dark.",
      "insects would be drawn away from homes.",
      "it interferes with sleep.",
      "electricity bills doubled.",
      "accidents and crime did not increase.",
      "provided only where and when it is needed.",
      "residents asked for brighter lamps.",
    ]),
  },
  {
    importId: "fsa-g-r3-diagram",
    groupKey: "r3-diagram",
    skill: "reading",
    passageImportId: "fsa-r3",
    orderIndex: 18,
    title: "Questions 36 and 37",
    instructions: "Label the diagram below. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
    answerMode: "text",
    stimulus: {
      kind: "image",
      assetImportId: "diagram-streetlight",
      alt: "Side view of a full cut-off streetlight: a pole, a lamp head, a fitting above the lamp that stops light going upwards, and a small unit on the pole.",
      caption: "A full cut-off streetlight",
      hotspots: [
        { slot: "36", x: 70, y: 14, label: "36" },
        { slot: "37", x: 72, y: 46, label: "37" },
      ],
    },
  },
  {
    importId: "fsa-g-r3-mcq",
    groupKey: "r3-mcq",
    skill: "reading",
    passageImportId: "fsa-r3",
    orderIndex: 19,
    title: "Question 38",
    instructions: "Choose the correct letter, A, B, C or D.",
    answerMode: "select",
  },
  {
    importId: "fsa-g-r3-multi",
    groupKey: "r3-multi",
    skill: "reading",
    passageImportId: "fsa-r3",
    orderIndex: 20,
    title: "Questions 39 and 40",
    instructions: "Choose TWO letters, A–E.",
    answerMode: "select",
  },
];

/* ------------------------------------------------------------------ */
/* Questions — Listening                                               */
/* ------------------------------------------------------------------ */

type QInput = Omit<AuthoredQuestion, "skill" | "importId" | "orderIndex"> & { n: number };

/** Listening row index for question number `n`: rows are contiguous, and the
 * numberSpan-2 rows at 21–22 and 23–24 each occupy a single row. */
function listeningRow(n: number): number {
  return n - 1 - (n > 22 ? 1 : 0) - (n > 24 ? 1 : 0);
}

function lq(input: QInput): AuthoredQuestion {
  const { n, ...rest } = input;
  return { importId: `fsa-l-${String(n).padStart(2, "0")}`, skill: "listening", orderIndex: listeningRow(n), ...rest };
}

/** Reading rows: the only numberSpan-2 row is the last one (39–40), so row = n - 1. */
function rq(input: QInput): AuthoredQuestion {
  const { n, ...rest } = input;
  return { importId: `fsa-r-${String(n).padStart(2, "0")}`, skill: "reading", orderIndex: n - 1, ...rest };
}

const FORM = { questionType: "note_table_form_flowchart_completion" as const, sectionImportId: "fsa-l1", groupKey: "l1-form", wordLimit: 1 };

const listeningQuestions: AuthoredQuestion[] = [
  lq({
    n: 1, ...FORM, slot: "1", prompt: "Question 1", correctAnswer: "KOVACS",
    support: "K-O-V-A-C-S",
    explanationEn: "The caller spells his surname letter by letter: K-O-V-A-C-S.",
    explanationVi: "Người gọi đánh vần họ của mình từng chữ: K-O-V-A-C-S.",
    markingCases: [
      { input: "Kovacs", expectedPoints: 1, note: "case-insensitive" },
      { input: "Kovaks", expectedPoints: 0, note: "misspelt" },
    ],
  }),
  lq({
    n: 2, ...FORM, slot: "2", prompt: "Question 2", correctAnswer: "intermediate",
    support: "I think intermediate would suit me better than beginners",
    explanationEn: "He rejects beginners and chooses the intermediate level.",
    explanationVi: "Anh ấy không chọn lớp cơ bản mà chọn trình độ trung cấp (intermediate).",
  }),
  lq({
    n: 3, ...FORM, slot: "3", prompt: "Question 3", correctAnswer: "07700 900431", allowNumber: true,
    acceptVariants: ["07700900431"],
    support: "My mobile is 07700 900431",
    explanationEn: "The mobile number is given once and then confirmed by the receptionist.",
    explanationVi: "Số điện thoại di động được nói một lần rồi lễ tân nhắc lại để xác nhận.",
    markingCases: [
      { input: "07700900431", expectedPoints: 1, note: "digits without the space accepted" },
      { input: "07700 900431", expectedPoints: 1, note: "canonical" },
      { input: "07700 900413", expectedPoints: 0, note: "wrong digits" },
    ],
  }),
  lq({
    n: 4, ...FORM, slot: "4", prompt: "Question 4", correctAnswer: "apron",
    support: "You'll need to bring an apron",
    explanationEn: "The receptionist says an apron is essential; old clothes are merely a suggestion.",
    explanationVi: "Lễ tân nói tạp dề (apron) là bắt buộc; quần áo cũ chỉ là gợi ý.",
    markingCases: [
      { input: "an apron", expectedPoints: 0, note: "two words exceed the ONE WORD limit (articles count as words)" },
      { input: "old clothes", expectedPoints: 0, note: "distractor" },
    ],
  }),
  lq({
    n: 5, ...FORM, slot: "5", prompt: "Question 5", correctAnswer: "3 March", allowNumber: true,
    acceptVariants: ["3rd March", "March 3", "third of March"],
    support: "begins on the third of March. Not February",
    explanationEn: "February on the old leaflet is a distractor; the course now starts on 3 March.",
    explanationVi: "Tháng Hai trên tờ rơi cũ là thông tin gây nhiễu; khoá học bắt đầu ngày 3 tháng Ba.",
    markingCases: [
      { input: "3rd March", expectedPoints: 1, note: "ordinal variant" },
      { input: "3 February", expectedPoints: 0, note: "distractor month" },
    ],
  }),
  lq({
    n: 6, ...FORM, slot: "6", prompt: "Question 6", correctAnswer: "85", allowNumber: true,
    acceptVariants: ["£85", "85 pounds"],
    support: "It's eighty-five pounds for the whole course. It was ninety last year",
    explanationEn: "Ninety pounds was last year's fee; this year it is eighty-five.",
    explanationVi: "Chín mươi bảng là học phí năm ngoái; năm nay là tám mươi lăm bảng.",
    markingCases: [
      { input: "£85", expectedPoints: 1, note: "currency symbol variant" },
      { input: "85 pounds", expectedPoints: 1, note: "spelt currency variant" },
      { input: "90", expectedPoints: 0, note: "last year's fee" },
    ],
  }),
  lq({
    n: 7, ...FORM, slot: "7", prompt: "Question 7", correctAnswer: "6", allowNumber: true,
    support: "Six sessions, each two hours long. We used to run eight",
    explanationEn: "Eight sessions is the old arrangement; there are now six.",
    explanationVi: "Tám buổi là cách sắp xếp cũ; hiện nay là sáu buổi.",
    markingCases: [
      { input: "six", expectedPoints: 1, note: "number word accepted for a numeral key" },
      { input: "8", expectedPoints: 0, note: "old number of sessions" },
    ],
  }),
  lq({
    n: 8, ...FORM, slot: "8", prompt: "Question 8", correctAnswer: "second-hand/secondhand",
    support: "a box of second-hand tools that you can use free of charge",
    explanationEn: "The studio's free tools are second-hand ones.",
    explanationVi: "Dụng cụ miễn phí của xưởng là đồ đã qua sử dụng (second-hand).",
    markingCases: [
      { input: "second hand", expectedPoints: 0, note: "two words exceed the ONE WORD limit (hyphenated form is one word)" },
      { input: "Second-Hand", expectedPoints: 1, note: "case-insensitive hyphenated form" },
      { input: "secondhand", expectedPoints: 1, note: "closed compound" },
      { input: "new", expectedPoints: 0, note: "wrong" },
    ],
  }),
  lq({
    n: 9, ...FORM, slot: "9", prompt: "Question 9", correctAnswer: "basement",
    support: "It's in the basement, directly under the main hall",
    explanationEn: "The class is held in the basement under the main hall, not in the hall itself.",
    explanationVi: "Lớp học diễn ra ở tầng hầm (basement) dưới hội trường chính, không phải trong hội trường.",
  }),
  lq({
    n: 10, ...FORM, slot: "10", prompt: "Question 10", correctAnswer: "library",
    support: "park behind the library across the road",
    explanationEn: "Evening students are asked to park behind the library.",
    explanationVi: "Học viên buổi tối được yêu cầu đỗ xe phía sau thư viện (library).",
    markingCases: [{ input: "the library", expectedPoints: 0, note: "two words exceed the ONE WORD limit (articles count as words)" }],
  }),

  /* Part 2: map */
  ...([
    [11, "Café", "B", "Straight ahead of you, just inside the gate, is the café", "The café is straight ahead just inside the gate; its old site by the lake is a distractor.", "Quán cà phê ở ngay phía trước, vừa qua cổng; vị trí cũ cạnh hồ là thông tin gây nhiễu."],
    [12, "Changing rooms", "A", "they're immediately on your left, in the long single-storey block", "The changing rooms are immediately on the left as you enter.", "Phòng thay đồ ở ngay bên trái khi bạn bước vào."],
    [13, "Bike hire", "C", "follow the path up the west side, about halfway along you'll come to the bike hire hut", "The bike hire hut is halfway up the west side of the loop path.", "Chòi thuê xe đạp nằm ở giữa cạnh phía tây của đường vòng."],
    [14, "First-aid point", "H", "In the centre of the park, where the two cross-paths meet, there's a small round building. That's the first-aid point", "The first-aid point is the round building in the centre of the park.", "Điểm sơ cứu là toà nhà tròn ở trung tâm công viên."],
    [15, "Climbing wall", "F", "in the north-east corner you'll see a tall grey tower. That's the climbing wall", "The climbing wall is the tower in the north-east corner by the river.", "Tường leo núi là toà tháp ở góc đông bắc cạnh sông."],
    [16, "Picnic area", "D", "Carry on to the north-west corner, right beside the river, and you'll find the picnic area", "The picnic area is in the north-west corner beside the river.", "Khu dã ngoại ở góc tây bắc cạnh sông."],
  ] as const).map(([n, prompt, key, support, en, vi]) =>
    lq({
      n, questionType: "map_plan_label", sectionImportId: "fsa-l2", groupKey: "l2-map", slot: String(n),
      prompt, correctAnswer: key, support, explanationEn: en, explanationVi: vi,
    }),
  ),

  /* Part 2: MCQ */
  lq({
    n: 17, questionType: "mcq_single", sectionImportId: "fsa-l2", groupKey: "l2-mcq",
    prompt: "To use the tennis courts, visitors must",
    options: letterOptions(["book online the day before.", "pay at the entrance kiosk.", "show a membership card."]),
    correctAnswer: "A",
    support: "they must be booked online at least a day ahead",
    explanationEn: "Courts must be booked online at least a day ahead; paying at the kiosk is no longer possible.",
    explanationVi: "Sân phải được đặt trực tuyến trước ít nhất một ngày; không còn trả tiền tại quầy được nữa.",
  }),
  lq({
    n: 18, questionType: "mcq_single", sectionImportId: "fsa-l2", groupKey: "l2-mcq",
    prompt: "In winter, the park gates close at",
    options: letterOptions(["6 p.m.", "8 p.m.", "10 p.m."]),
    correctAnswer: "B",
    support: "from November to March we close at eight",
    explanationEn: "Ten o'clock is the summer closing time; from November to March the gates close at eight.",
    explanationVi: "Mười giờ là giờ đóng cửa mùa hè; từ tháng 11 đến tháng 3 cổng đóng lúc tám giờ.",
  }),
  lq({
    n: 19, questionType: "mcq_single", sectionImportId: "fsa-l2", groupKey: "l2-mcq",
    prompt: "What is new at the park this year?",
    options: letterOptions(["an outdoor gym", "a running track", "a children's pool"]),
    correctAnswer: "A",
    support: "What's new this year is the outdoor gym beside the running track",
    explanationEn: "The outdoor gym is new; the running track already existed.",
    explanationVi: "Phòng tập ngoài trời là mới; đường chạy đã có từ trước.",
  }),
  lq({
    n: 20, questionType: "mcq_single", sectionImportId: "fsa-l2", groupKey: "l2-mcq",
    prompt: "What does the guide say about the lake?",
    options: letterOptions(["Swimming is not permitted.", "Boats cannot be used.", "Fishing is free of charge."]),
    correctAnswer: "A",
    support: "no swimming in the lake",
    explanationEn: "Swimming is forbidden; boats are allowed and fishing needs a permit.",
    explanationVi: "Cấm bơi; thuyền được phép và câu cá cần giấy phép.",
  }),

  /* Part 3 */
  lq({
    n: 21, questionType: "mcq_multi", sectionImportId: "fsa-l3", groupKey: "l3-multi-a",
    numberSpan: 2, selectCount: 2, maxPoints: 2,
    prompt: "Which TWO problems did Priya and Tomas have with their pilot survey?",
    options: letterOptions([
      "Their equipment was damaged.",
      "The weather was poor.",
      "They collected too few samples.",
      "The site was difficult to reach.",
      "Their recording sheets were confusing.",
    ]),
    correctAnswer: ["C", "E"],
    support: "we only managed twelve samples in the whole afternoon, and that's really too few",
    explanationEn: "Too few samples and confusing recording sheets; the weather, access and equipment were all fine.",
    explanationVi: "Quá ít mẫu và phiếu ghi chép khó hiểu; thời tiết, đường đi và thiết bị đều ổn.",
    markingCases: [
      { input: ["C", "E"], expectedPoints: 2, note: "both correct, any order" },
      { input: ["E", "C"], expectedPoints: 2, note: "order irrelevant" },
      { input: ["C", "B"], expectedPoints: 1, note: "one correct" },
      { input: ["A", "B"], expectedPoints: 0, note: "none correct" },
    ],
  }),
  lq({
    n: 23, questionType: "mcq_multi", sectionImportId: "fsa-l3", groupKey: "l3-multi-b",
    numberSpan: 2, selectCount: 2, maxPoints: 2,
    prompt: "Which TWO changes does the tutor recommend for the main study?",
    options: letterOptions([
      "visiting the site at a different time of day",
      "using a standard sampling net",
      "adding a second site for comparison",
      "photographing every sample",
      "extending the project by a week",
    ]),
    correctAnswer: ["B", "C"],
    support: "use the standard sampling net from the store rather than the one you made",
    explanationEn: "The tutor recommends the standard net and a second site; photographs are optional and no extension is allowed.",
    explanationVi: "Giảng viên khuyên dùng lưới chuẩn và thêm địa điểm thứ hai; chụp ảnh là tuỳ chọn và không gia hạn.",
    markingCases: [
      { input: ["B", "C"], expectedPoints: 2, note: "both correct" },
      { input: ["B", "D"], expectedPoints: 1, note: "one correct" },
    ],
  }),
  lq({
    n: 25, questionType: "short_answer", sectionImportId: "fsa-l3", groupKey: "l3-any", wordLimit: 1,
    prompt: "Question 25", correctAnswer: "laboratory/library",
    support: "We'll sort the samples in the laboratory",
    explanationEn: "The students will use the laboratory and the library; the lecture hall is declined.",
    explanationVi: "Sinh viên sẽ dùng phòng thí nghiệm và thư viện; họ từ chối giảng đường.",
    markingCases: [
      { input: "laboratory", expectedPoints: 1, note: "either facility accepted in either row" },
      { input: "library", expectedPoints: 1, note: "either facility accepted in either row" },
      { input: "lecture hall", expectedPoints: 0, note: "declined facility" },
    ],
  }),
  lq({
    n: 26, questionType: "short_answer", sectionImportId: "fsa-l3", groupKey: "l3-any", wordLimit: 1,
    prompt: "Question 26", correctAnswer: "laboratory/library",
    support: "we'll use the library for the identification guides",
    explanationEn: "The second facility is whichever of laboratory or library was not given for Question 25.",
    explanationVi: "Cơ sở thứ hai là phòng thí nghiệm hoặc thư viện, tuỳ câu nào chưa dùng ở câu 25.",
    markingCases: [
      { input: "library", expectedPoints: 1, note: "either facility accepted in either row" },
      { input: "laboratory", expectedPoints: 1, note: "either facility accepted in either row" },
      { input: "microscopes", expectedPoints: 0, note: "not a facility" },
    ],
  }),
  ...([
    [27, "writing the risk assessment", "A", "I'll write the risk assessment, since I did one last year", "Priya volunteers for the risk assessment.", "Priya nhận viết bản đánh giá rủi ro."],
    [28, "booking the minibus", "B", "I'll book the minibus", "Tomas will book the minibus.", "Tomas sẽ đặt xe buýt nhỏ."],
    [29, "identifying the specimens", "C", "We'll do that together. Neither of us is confident enough", "Both students will identify the specimens together.", "Cả hai sinh viên sẽ cùng nhau nhận diện mẫu vật."],
    [30, "preparing the poster", "C", "we'll both prepare the poster for the presentation", "Both will prepare the poster.", "Cả hai sẽ cùng chuẩn bị poster."],
  ] as const).map(([n, prompt, key, support, en, vi]) =>
    lq({
      n, questionType: "matching_features", sectionImportId: "fsa-l3", groupKey: "l3-features",
      prompt, correctAnswer: key, support, explanationEn: en, explanationVi: vi,
    }),
  ),

  /* Part 4 */
  lq({
    n: 31, questionType: "note_table_form_flowchart_completion", sectionImportId: "fsa-l4", groupKey: "l4-flow", slot: "31", wordLimit: 2,
    prompt: "Question 31", correctAnswer: "roof-top/rooftop",
    support: "we record the roof-top temperature before any work begins",
    explanationEn: "The baseline reading is the roof-top temperature.",
    explanationVi: "Số đo cơ sở là nhiệt độ mái nhà (roof-top).",
    markingCases: [
      { input: "rooftop", expectedPoints: 1, note: "closed alternative" },
      { input: "roof top", expectedPoints: 1, note: "hyphen/space equivalence" },
      { input: "street", expectedPoints: 0, note: "wrong" },
    ],
  }),
  lq({
    n: 32, questionType: "note_table_form_flowchart_completion", sectionImportId: "fsa-l4", groupKey: "l4-flow", slot: "32", wordLimit: 2,
    prompt: "Question 32", correctAnswer: "cracks",
    support: "the surface is cleaned and any cracks are sealed",
    explanationEn: "Cracks must be sealed before coating.",
    explanationVi: "Các vết nứt (cracks) phải được bịt kín trước khi phủ.",
  }),
  lq({
    n: 33, questionType: "note_table_form_flowchart_completion", sectionImportId: "fsa-l4", groupKey: "l4-flow", slot: "33", wordLimit: 2,
    prompt: "Question 33", correctAnswer: "two coats", allowNumber: true,
    support: "two coats, allowing the first to dry completely before the second",
    explanationEn: "Two coats are applied, the first drying fully before the second.",
    explanationVi: "Phủ hai lớp (two coats), lớp đầu khô hoàn toàn rồi mới phủ lớp thứ hai.",
    markingCases: [
      { input: "2 coats", expectedPoints: 1, note: "numeral for number word" },
      { input: "one coat", expectedPoints: 0, note: "wrong" },
    ],
  }),
  lq({
    n: 34, questionType: "note_table_form_flowchart_completion", sectionImportId: "fsa-l4", groupKey: "l4-flow", slot: "34", wordLimit: 2,
    prompt: "Question 34", correctAnswer: "six months", allowNumber: true,
    support: "the coating is inspected every six months",
    explanationEn: "Inspection takes place every six months.",
    explanationVi: "Việc kiểm tra diễn ra sáu tháng một lần.",
    markingCases: [
      { input: "6 months", expectedPoints: 1, note: "numeral for number word" },
      { input: "year", expectedPoints: 0, note: "wrong interval" },
    ],
  }),
  lq({
    n: 35, questionType: "sentence_completion", sectionImportId: "fsa-l4", groupKey: "l4-sentence", wordLimit: 2,
    prompt: "Early cool roofs were simply covered in __BLANK_0__.",
    correctAnswer: "white paint/reflective paint",
    support: "Early cool roofs were simply covered in white paint",
    explanationEn: "The lecturer says early cool roofs were covered in white paint, and that any reflective paint does the job.",
    explanationVi: "Giảng viên nói mái mát thời kỳ đầu được phủ sơn trắng, và sơn phản xạ nào cũng làm được việc.",
    markingCases: [
      { input: "reflective paint", expectedPoints: 1, note: "slash alternative" },
      { input: "paint", expectedPoints: 0, note: "incomplete" },
    ],
  }),
  lq({
    n: 36, questionType: "sentence_completion", sectionImportId: "fsa-l4", groupKey: "l4-sentence", wordLimit: 2,
    prompt: "A very white roof can cause __BLANK_0__ for people in nearby tall buildings.",
    correctAnswer: "glare",
    support: "A very white roof can produce glare for people in taller buildings nearby",
    explanationEn: "Glare is the drawback for occupants of taller buildings.",
    explanationVi: "Chói loá (glare) là nhược điểm đối với người ở các toà nhà cao hơn.",
  }),
  lq({
    n: 37, questionType: "sentence_completion", sectionImportId: "fsa-l4", groupKey: "l4-sentence", wordLimit: 2,
    prompt: "Green roofs are covered in __BLANK_0__ and also reduce rainwater run-off.",
    correctAnswer: "vegetation/plants",
    support: "green roofs, which are covered in vegetation",
    explanationEn: "Green roofs are covered in vegetation (plants).",
    explanationVi: "Mái xanh được phủ thảm thực vật (cây cối).",
    markingCases: [{ input: "plants", expectedPoints: 1, note: "slash alternative" }],
  }),
  lq({
    n: 38, questionType: "short_answer", sectionImportId: "fsa-l4", groupKey: "l4-short", wordLimit: 2,
    prompt: "What type of building did the researchers study first?",
    correctAnswer: "warehouse",
    support: "Our first study was of a warehouse on the edge of the city",
    explanationEn: "The first study building was a warehouse.",
    explanationVi: "Toà nhà nghiên cứu đầu tiên là một nhà kho (warehouse).",
    markingCases: [
      { input: "a warehouse", expectedPoints: 1, note: "leading article ignored" },
      { input: "office", expectedPoints: 0, note: "wrong" },
    ],
  }),
  lq({
    n: 39, questionType: "short_answer", sectionImportId: "fsa-l4", groupKey: "l4-short", wordLimit: 2,
    prompt: "In which season was the energy saving greatest?",
    correctAnswer: "summer",
    support: "The largest energy saving was in summer",
    explanationEn: "The largest saving came in summer, when air conditioning worked hardest.",
    explanationVi: "Tiết kiệm lớn nhất vào mùa hè, khi điều hoà hoạt động nhiều nhất.",
    markingCases: [{ input: "the summer", expectedPoints: 1, note: "leading article ignored" }],
  }),
  lq({
    n: 40, questionType: "short_answer", sectionImportId: "fsa-l4", groupKey: "l4-short", wordLimit: 2, allowNumber: true,
    prompt: "By how much did the warehouse's cooling costs fall over the summer?",
    correctAnswer: "15 percent",
    acceptVariants: ["15%", "fifteen percent"],
    support: "cooling costs fell by fifteen percent",
    explanationEn: "Cooling costs fell by fifteen percent.",
    explanationVi: "Chi phí làm mát giảm mười lăm phần trăm.",
    markingCases: [
      { input: "15%", expectedPoints: 1, note: "symbol variant" },
      { input: "fifteen percent", expectedPoints: 1, note: "number-word variant" },
      { input: "50 percent", expectedPoints: 0, note: "wrong figure" },
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Questions — Reading                                                 */
/* ------------------------------------------------------------------ */

const TFNG_OPTIONS: AuthoredBankOption[] = [
  { id: "true", label: "TRUE", text: "TRUE" },
  { id: "false", label: "FALSE", text: "FALSE" },
  { id: "not_given", label: "NOT GIVEN", text: "NOT GIVEN" },
];
const YNNG_OPTIONS: AuthoredBankOption[] = [
  { id: "yes", label: "YES", text: "YES" },
  { id: "no", label: "NO", text: "NO" },
  { id: "not_given", label: "NOT GIVEN", text: "NOT GIVEN" },
];

const readingQuestions: AuthoredQuestion[] = [
  /* Passage 1: headings */
  ...([
    [1, "A", "i", "A healthy dune system absorbs the energy of storm waves", "Paragraph A presents dunes as a cheap, self-repairing natural defence.", "Đoạn A trình bày cồn cát như một hàng rào tự nhiên rẻ và tự phục hồi."],
    [2, "B", "ii", "Dunes are lost for several reasons", "Paragraph B lists the causes of dune loss: trampling, building and sand starvation.", "Đoạn B liệt kê nguyên nhân mất cồn cát: giẫm đạp, xây dựng và thiếu cát."],
    [3, "C", "iii", "Restoration usually begins with the simplest of tools", "Paragraph C describes fences that slow the wind and trap sand.", "Đoạn C mô tả hàng rào làm chậm gió và giữ cát."],
    [4, "D", "iv", "Marram is remarkable because it is stimulated rather than harmed by being buried", "Paragraph D is about marram grass, which grows better when buried.", "Đoạn D nói về cỏ marram, loài mọc tốt hơn khi bị vùi."],
    [5, "E", "v", "None of this works if people keep walking over it", "Paragraph E is about managing visitors with boardwalks, fencing and volunteers.", "Đoạn E nói về quản lý du khách bằng lối đi ván, hàng rào và tình nguyện viên."],
    [6, "F", "vi", "Dunes are not fixed objects but moving ones", "Paragraph F argues that dunes need space to move inland over the long term.", "Đoạn F lập luận rằng cồn cát cần không gian để dịch chuyển vào đất liền về lâu dài."],
  ] as const).map(([n, para, key, support, en, vi]) =>
    rq({
      n, questionType: "matching_headings", passageImportId: "fsa-r1", groupKey: "r1-headings",
      prompt: `Paragraph ${para}`, correctAnswer: key, support, explanationEn: en, explanationVi: vi,
    }),
  ),
  /* Passage 1: TFNG */
  rq({
    n: 7, questionType: "true_false_notgiven", passageImportId: "fsa-r1", groupKey: "r1-tfng", options: TFNG_OPTIONS,
    prompt: "Over fifty years, maintaining a sea wall costs at least ten times as much as maintaining dunes.",
    correctAnswer: "true",
    support: "maintaining dunes costs less than a tenth of what it costs to maintain a comparable length of sea wall over fifty years",
    explanationEn: "Dunes cost less than a tenth of a sea wall, so the wall costs at least ten times more.",
    explanationVi: "Cồn cát tốn chưa đến một phần mười chi phí tường biển, nên tường biển tốn ít nhất gấp mười lần.",
  }),
  rq({
    n: 8, questionType: "true_false_notgiven", passageImportId: "fsa-r1", groupKey: "r1-tfng", options: TFNG_OPTIONS,
    prompt: "Blow-outs are mostly caused by unusually severe storms.",
    correctAnswer: "false",
    support: "The most common cause is simply feet",
    explanationEn: "The passage says the most common cause is people walking, not storms.",
    explanationVi: "Bài đọc nói nguyên nhân phổ biến nhất là người đi bộ, không phải bão.",
  }),
  rq({
    n: 9, questionType: "true_false_notgiven", passageImportId: "fsa-r1", groupKey: "r1-tfng", options: TFNG_OPTIONS,
    prompt: "Brushwood fences trap sand more effectively than slatted fences.",
    correctAnswer: "not_given",
    support: "Rows of wooden fences, made from slats or brushwood",
    explanationEn: "Both materials are mentioned but the passage does not compare their effectiveness.",
    explanationVi: "Cả hai vật liệu đều được nhắc đến nhưng bài không so sánh hiệu quả.",
  }),
  rq({
    n: 10, questionType: "true_false_notgiven", passageImportId: "fsa-r1", groupKey: "r1-tfng", options: TFNG_OPTIONS,
    prompt: "Marram grass is planted only in spring.",
    correctAnswer: "false",
    support: "Volunteers plant the grass in the autumn and spring",
    explanationEn: "Planting happens in both autumn and spring.",
    explanationVi: "Việc trồng diễn ra cả mùa thu và mùa xuân.",
  }),
  /* Passage 1: notes */
  rq({
    n: 11, questionType: "note_table_form_flowchart_completion", passageImportId: "fsa-r1", groupKey: "r1-notes", slot: "11", wordLimit: 2,
    prompt: "Question 11", correctAnswer: "wooden fences/timber fences",
    support: "Rows of wooden fences",
    explanationEn: "Rows of wooden fences slow the wind so it drops its sand.",
    explanationVi: "Các hàng rào gỗ làm chậm gió để gió thả cát xuống.",
    markingCases: [
      { input: "wooden fences", expectedPoints: 1, note: "canonical" },
      { input: "timber fences", expectedPoints: 1, note: "slash alternative" },
      { input: "fences", expectedPoints: 0, note: "incomplete" },
    ],
  }),
  rq({
    n: 12, questionType: "note_table_form_flowchart_completion", passageImportId: "fsa-r1", groupKey: "r1-notes", slot: "12", wordLimit: 2, allowNumber: true,
    prompt: "Question 12", correctAnswer: "three years",
    support: "typically forms within three years",
    explanationEn: "A new foredune typically forms within three years.",
    explanationVi: "Một cồn cát tiền duyên mới thường hình thành trong vòng ba năm.",
    markingCases: [
      { input: "3 years", expectedPoints: 1, note: "numeral for number word" },
      { input: "one year", expectedPoints: 0, note: "wrong" },
    ],
  }),
  rq({
    n: 13, questionType: "note_table_form_flowchart_completion", passageImportId: "fsa-r1", groupKey: "r1-notes", slot: "13", wordLimit: 2,
    prompt: "Question 13", correctAnswer: "marram grass",
    support: "plant marram grass",
    explanationEn: "Marram grass is planted because burial stimulates its growth.",
    explanationVi: "Cỏ marram được trồng vì bị vùi lấp kích thích nó phát triển.",
    markingCases: [
      { input: "the marram grass", expectedPoints: 0, note: "three words exceed the TWO WORDS limit" },
      { input: "marram", expectedPoints: 0, note: "incomplete" },
    ],
  }),

  /* Passage 2: matching information */
  ...([
    [14, "a reference to the number of walkers using a well-known route", "G", "attracts around 250,000 walkers a year", "Paragraph G gives the annual number of walkers on the coastal path.", "Đoạn G nêu số người đi bộ hằng năm trên đường ven biển."],
    [15, "an explanation of why routes are kept away from roads", "D", "even short sections along a road break the sense of being on a journey", "Paragraph D explains safety and the loss of the sense of journey.", "Đoạn D giải thích lý do an toàn và mất cảm giác hành trình."],
    [16, "a description of how a signing scheme is tested", "E", "sending volunteers unfamiliar with the area along the route with no map", "Paragraph E describes the volunteer test for waymarking.", "Đoạn E mô tả cách thử nghiệm biển chỉ dẫn với tình nguyện viên."],
    [17, "a mention of disagreement among people who own land on a route", "G", "Landowners along a proposed route are often divided", "Paragraph G says landowners are often divided.", "Đoạn G nói chủ đất thường bất đồng."],
    [18, "a claim that early routes were created without much planning", "A", "simply joined existing tracks together and hoped for the best", "Paragraph A says classic routes were joined together by enthusiasts hoping for the best.", "Đoạn A nói các tuyến cổ điển được nối lại bởi những người đam mê và hy vọng điều tốt nhất."],
  ] as const).map(([n, prompt, key, support, en, vi]) =>
    rq({
      n, questionType: "matching_information", passageImportId: "fsa-r2", groupKey: "r2-info",
      prompt, correctAnswer: key, support, explanationEn: en, explanationVi: vi,
    }),
  ),
  /* Passage 2: matching features */
  ...([
    [19, "Walkers value variety of landscape more than distance.", "A", "the quality they valued most was not distance, or even dramatic views, but change", "Marsh found walkers valued change over distance.", "Marsh thấy người đi bộ coi trọng sự thay đổi hơn khoảng cách."],
    [20, "Local businesses gain most when a route passes through small settlements.", "C", "passes through the middle of a small settlement every fifteen to twenty kilometres supports shops", "Sol's economic research links routing through settlements to local spending.", "Nghiên cứu kinh tế của Sol liên hệ việc đi qua khu dân cư với chi tiêu địa phương."],
    [21, "Too many signs reduce the sense of adventure.", "B", "over-signing removes the mild uncertainty that makes a long walk feel like an adventure", "Anand argues that over-signing removes the feeling of adventure.", "Anand lập luận rằng quá nhiều biển báo làm mất cảm giác phiêu lưu."],
    [22, "The surface of a path should depend on how heavily it will be used.", "B", "models expected footfall for each section of a proposed route before choosing materials", "Anand chooses materials according to expected footfall.", "Anand chọn vật liệu theo lưu lượng người đi dự kiến."],
  ] as const).map(([n, prompt, key, support, en, vi]) =>
    rq({
      n, questionType: "matching_features", passageImportId: "fsa-r2", groupKey: "r2-features",
      prompt, correctAnswer: key, support, explanationEn: en, explanationVi: vi,
    }),
  ),
  /* Passage 2: summary (select) */
  ...([
    [23, "D", "keep walkers off roads", "Both researchers agree routes should avoid roads.", "Cả hai nhà nghiên cứu đồng ý tuyến đường nên tránh đường ô tô."],
    [24, "F", "not distance, or even dramatic views, but change", "Walkers valued change, i.e. variety.", "Người đi bộ coi trọng sự thay đổi, tức là sự đa dạng."],
    [25, "B", "His work concerns the surface of the path itself", "Anand's work is about the path surface.", "Công việc của Anand liên quan đến bề mặt đường."],
    [26, "A", "A route that skirts around villages to stay in open country may be prettier, but it sends almost nothing into the local economy", "Routes through villages bring money to communities.", "Tuyến đi qua làng mạc mang lại tiền cho cộng đồng."],
  ] as const).map(([n, key, support, en, vi]) =>
    rq({
      n, questionType: "summary_completion", passageImportId: "fsa-r2", groupKey: "r2-summary", slot: String(n),
      prompt: `Question ${n}`, correctAnswer: key, support, explanationEn: en, explanationVi: vi,
    }),
  ),

  /* Passage 3: YNNG */
  ...([
    [27, "The earliest street lighting was installed primarily to make streets safer.", "no", "their aim was commercial", "The writer says the first gas lamps had a commercial aim; safety came later.", "Tác giả nói đèn khí đầu tiên có mục đích thương mại; an toàn đến sau."],
    [28, "The public overestimates how much lighting reduces crime.", "yes", "The evidence for that common sense is thinner than its popularity suggests", "The writer says the evidence is thinner than its popularity suggests.", "Tác giả nói bằng chứng mỏng hơn mức độ phổ biến của niềm tin đó."],
    [29, "Light pollution harms insects more than it harms birds.", "not_given", "insects circle lamps until they die", "Both are mentioned as harmed, but no comparison is made.", "Cả hai đều được nhắc là bị hại, nhưng không có so sánh."],
    [30, "Reducing street lighting after midnight led to more road accidents in the towns studied.", "no", "Night-time road accidents did not rise on the dimmed or switched-off streets", "The study found accidents did not rise.", "Nghiên cứu cho thấy tai nạn không tăng."],
    [31, "Cities should stop lighting their streets altogether.", "no", "I am not arguing for an unlit city", "The writer explicitly rejects an unlit city.", "Tác giả rõ ràng phản đối thành phố không có đèn."],
  ] as const).map(([n, prompt, key, support, en, vi]) =>
    rq({
      n, questionType: "yes_no_notgiven", passageImportId: "fsa-r3", groupKey: "r3-ynng", options: YNNG_OPTIONS,
      prompt, correctAnswer: key, support, explanationEn: en, explanationVi: vi,
    }),
  ),
  /* Passage 3: sentence endings */
  ...([
    [32, "The first gas lamps in cities were installed so that", "A", "they allowed shops to stay open after dark", "Gas lamps let shops trade after dark.", "Đèn khí cho phép cửa hàng buôn bán sau khi trời tối."],
    [33, "White LED lighting has been criticised because", "C", "suppresses the hormone that prepares the body for sleep", "Blue-rich LED light suppresses the sleep hormone.", "Ánh sáng LED giàu xanh ức chế hormone gây ngủ."],
    [34, "The northern towns that dimmed or switched off lights found that", "E", "neither did recorded crime", "Neither accidents nor crime increased.", "Cả tai nạn lẫn tội phạm đều không tăng."],
    [35, "The writer believes that street lighting should be", "F", "directed where it is needed and withheld where it is not", "Light should be directed where needed and withheld where not.", "Ánh sáng nên hướng đến nơi cần và không dùng ở nơi không cần."],
  ] as const).map(([n, prompt, key, support, en, vi]) =>
    rq({
      n, questionType: "matching_sentence_endings", passageImportId: "fsa-r3", groupKey: "r3-endings",
      prompt, correctAnswer: key, support, explanationEn: en, explanationVi: vi,
    }),
  ),
  /* Passage 3: diagram */
  rq({
    n: 36, questionType: "diagram_label", passageImportId: "fsa-r3", groupKey: "r3-diagram", slot: "36", wordLimit: 2,
    prompt: "Question 36", correctAnswer: "shield/hood",
    support: "a shield, or hood, fitted above the lamp so that light is directed downwards",
    explanationEn: "The part above the lamp that directs light downwards is a shield or hood.",
    explanationVi: "Bộ phận phía trên đèn hướng ánh sáng xuống là tấm chắn (shield) hay chụp (hood).",
    markingCases: [
      { input: "hood", expectedPoints: 1, note: "slash alternative" },
      { input: "a shield", expectedPoints: 1, note: "leading article ignored" },
      { input: "lamp", expectedPoints: 0, note: "wrong part" },
    ],
  }),
  rq({
    n: 37, questionType: "diagram_label", passageImportId: "fsa-r3", groupKey: "r3-diagram", slot: "37", wordLimit: 2,
    prompt: "Question 37", correctAnswer: "light sensor",
    support: "Each lamp carries a light sensor that switches it on only when natural light has faded",
    explanationEn: "The unit that switches the lamp on when daylight fades is the light sensor.",
    explanationVi: "Bộ phận bật đèn khi trời tối là cảm biến ánh sáng (light sensor).",
    markingCases: [
      { input: "light-sensor", expectedPoints: 1, note: "hyphen/space equivalence" },
      { input: "sensor", expectedPoints: 0, note: "incomplete" },
    ],
  }),
  /* Passage 3: MCQ single */
  rq({
    n: 38, questionType: "mcq_single", passageImportId: "fsa-r3", groupKey: "r3-mcq",
    prompt: "What is the writer's main purpose in this passage?",
    options: letterOptions([
      "to call for an end to street lighting",
      "to argue that lighting should be used more selectively",
      "to describe the history of gas lighting",
      "to warn that dimming lights increases crime",
    ]),
    correctAnswer: "B",
    support: "light, like water or heat, is something to be directed where it is needed and withheld where it is not",
    explanationEn: "The writer argues for directing light only where and when it is needed.",
    explanationVi: "Tác giả lập luận chỉ nên chiếu sáng ở nơi và lúc cần thiết.",
  }),
  /* Passage 3: MCQ multi */
  rq({
    n: 39, questionType: "mcq_multi", passageImportId: "fsa-r3", groupKey: "r3-multi",
    numberSpan: 2, selectCount: 2, maxPoints: 2,
    prompt: "Which TWO effects of adaptive lighting trials does the writer mention?",
    options: letterOptions([
      "Energy use fell by more than half.",
      "Lamps needed replacing less often.",
      "The night sky became slightly darker.",
      "Road accidents decreased.",
      "Residents reported sleeping better.",
    ]),
    correctAnswer: ["A", "C"],
    support: "cut lighting energy use by more than half without residents noticing much difference, except that the sky above them has become slightly darker",
    explanationEn: "The trials cut energy use by more than half and made the sky slightly darker.",
    explanationVi: "Các thử nghiệm giảm hơn một nửa năng lượng và làm bầu trời tối hơn một chút.",
    markingCases: [
      { input: ["A", "C"], expectedPoints: 2, note: "both correct" },
      { input: ["C", "A"], expectedPoints: 2, note: "order irrelevant" },
      { input: ["A", "E"], expectedPoints: 1, note: "one correct" },
    ],
  }),
];

/* ------------------------------------------------------------------ */
/* Writing & Speaking                                                  */
/* ------------------------------------------------------------------ */

const writingQuestions: AuthoredQuestion[] = [
  {
    importId: "fsa-w-1",
    skill: "writing",
    questionType: "writing_task1_academic",
    orderIndex: 0,
    prompt:
      "The line graph shows the percentage of household waste that was recycled in four European countries between 2000 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
    wordLimit: 150,
    visual: {
      type: "chart",
      chartType: "line",
      title: "Percentage of household waste recycled, 2000–2020",
      xAxisKey: "year",
      data: [
        { year: "2000", germany: 38, uk: 11, spain: 14, poland: 3 },
        { year: "2005", germany: 47, uk: 24, spain: 20, poland: 5 },
        { year: "2010", germany: 55, uk: 40, spain: 27, poland: 12 },
        { year: "2015", germany: 62, uk: 44, spain: 30, poland: 26 },
        { year: "2020", germany: 66, uk: 45, spain: 35, poland: 34 },
      ],
      series: [
        { dataKey: "germany", label: "Germany" },
        { dataKey: "uk", label: "United Kingdom" },
        { dataKey: "spain", label: "Spain" },
        { dataKey: "poland", label: "Poland" },
      ],
    },
    explanationEn: "Report the overall upward trend, identify Germany as the consistent leader, and compare the speed of growth in the UK and Poland.",
    explanationVi: "Nêu xu hướng tăng chung, chỉ ra Đức luôn dẫn đầu, và so sánh tốc độ tăng của Anh và Ba Lan.",
    modelAnswer:
      "The graph compares the proportion of household waste recycled in Germany, the United Kingdom, Spain and Poland over a twenty-year period from 2000 to 2020.\n\nOverall, recycling rates rose in all four countries, although the gap between the highest and lowest performers narrowed considerably. Germany recycled the largest share throughout, while Poland began from the lowest point but recorded the most dramatic improvement.\n\nIn 2000, Germany already recycled 38 percent of its household waste, more than double the figure for Spain (14 percent) and well ahead of the UK (11 percent). Poland, at just 3 percent, lagged far behind. Germany's rate then climbed steadily, reaching 55 percent in 2010 and 66 percent by the end of the period.\n\nThe UK saw the fastest early growth, almost quadrupling to 40 percent by 2010, but progress then slowed and the rate reached only 45 percent in 2020. Spain's increase was more gradual, ending at 35 percent. Poland's rate remained negligible until 2005, but then surged from 12 percent in 2010 to 34 percent in 2020, almost matching Spain.",
    examinerNotes: {
      taskAchievement: "Clear overview (upward trend, narrowing gap), key features selected with data, sensible grouping of countries rather than year-by-year narration.",
      coherenceCohesion: "Four paragraphs with a logical progression: introduction, overview, leader, followers. Cohesive devices are varied and unforced.",
      lexicalResource: "Accurate trend vocabulary (climbed steadily, surged, negligible, lagged) and precise comparison language (more than double, almost quadrupling).",
      grammaticalRange: "Mix of simple and complex sentences, correct use of past tenses and comparative structures; punctuation accurate.",
    },
  },
  {
    importId: "fsa-w-2",
    skill: "writing",
    questionType: "writing_task2_essay",
    orderIndex: 1,
    prompt:
      "Some people believe that city centres should be closed to private cars, while others think that this would harm businesses and inconvenience residents. Discuss both these views and give your own opinion. Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.",
    wordLimit: 250,
    explanationEn: "A discussion essay: present both positions fairly, then commit to a clear opinion supported by reasons and examples.",
    explanationVi: "Bài luận thảo luận: trình bày công bằng cả hai quan điểm, sau đó nêu rõ ý kiến của bạn với lý do và ví dụ.",
    modelAnswer:
      "The question of whether private cars should be excluded from city centres divides opinion sharply. Supporters see cleaner air and safer streets; opponents fear empty shops and stranded residents. In my view, the benefits of car-free centres clearly outweigh the drawbacks, provided the change is introduced carefully.\n\nThose who favour a ban point first to health. Traffic is the main source of air pollution in most cities, and it is concentrated exactly where people gather to shop, work and eat. Removing cars from these areas cuts exposure to exhaust fumes and noise, and it also frees space that is currently devoted to parking. Cities that have pedestrianised their centres, such as several in the Netherlands and Spain, generally report more people on the streets, not fewer, because walking through them has become pleasant.\n\nOpponents argue that customers who cannot park will simply drive to out-of-town retail parks instead, leaving local businesses to fail. They also note that elderly or disabled residents, delivery drivers and tradespeople depend on vehicle access. These are legitimate concerns, but they are objections to a badly designed scheme rather than to the principle. Delivery windows in the early morning, permits for residents with mobility needs and frequent public transport address most of them.\n\nI therefore believe that city centres should be closed to most private cars, but that the closure must be accompanied by investment in buses, trams and cycle routes, and by consultation with the businesses affected. Where this has been done, shops have generally prospered rather than suffered.\n\nIn conclusion, although the fears of opponents deserve a practical response, a well-planned car-free centre benefits residents, visitors and traders alike.",
    examinerNotes: {
      taskResponse: "Both views are discussed with developed reasons and examples, and a clear, consistent opinion is stated in the introduction, body and conclusion.",
      coherenceCohesion: "Five paragraphs, each with a central topic; cohesion achieved through referencing (these, they, this) rather than mechanical linkers.",
      lexicalResource: "Topic vocabulary is precise (pedestrianised, exhaust fumes, delivery windows, mobility needs) with natural collocation.",
      grammaticalRange: "Wide range including conditionals, relative clauses, passive voice and inversion-free complex sentences; errors are absent.",
    },
  },
];

const SPEAKING_P1 = [
  ["Do you enjoy walking? Why or why not?", "I do, actually. I walk to work most days, which takes about twenty minutes, and I find it clears my head before I start. I would rather walk than sit in traffic, even in the rain."],
  ["Where do you usually go for a walk?", "Mostly along the river near my flat. There is a path that runs for a few kilometres, and in the evening it is quiet. At weekends I sometimes drive out to the hills, but that is more of a hike than a walk."],
  ["Did you walk more or less when you were a child?", "Probably more, though I did not notice it. We walked to school every day because it was close, and we played outside constantly. Now I have to make a deliberate decision to walk somewhere."],
  ["Do you think people in your country walk enough?", "Honestly, no. In the cities most people take a motorbike or a car for even short trips, partly because the pavements are crowded or blocked. It is starting to change, with more parks and pedestrian streets, but slowly."],
] as const;

const SPEAKING_P3 = [
  ["Why do some people dislike change in the places they live?", "I think a place holds memories, so when a familiar building disappears, people feel that part of their own history has gone with it. There is also a practical side: change often means noise, higher rents or losing a shop they relied on, so resistance is not just nostalgia."],
  ["Who should decide how a city changes: residents, businesses or the government?", "Ideally all three, but the government has to make the final call because it has to balance interests that conflict. What matters is that residents are genuinely consulted early, not shown a finished plan and asked to approve it."],
  ["Do you think cities will look very different in fifty years?", "In some ways, yes. I expect fewer cars, more green space and much taller housing, because land is scarce. But the basic layout of streets and squares tends to survive for centuries, so I think the bones of the city will still be recognisable."],
  ["Is it better to preserve old buildings or to replace them with modern ones?", "It depends on the building. Preserving everything freezes a city and makes it unaffordable, but demolishing character to save money is short-sighted. The best approach is usually to keep the facade or the structure and adapt the inside for a new use."],
] as const;

const speakingQuestions: AuthoredQuestion[] = [
  ...SPEAKING_P1.map(([prompt, model], i) => ({
    importId: `fsa-s-p1-${i + 1}`,
    skill: "speaking" as const,
    questionType: "speaking_part1" as const,
    orderIndex: i,
    prompt,
    explanationEn: "Part 1: give a direct answer plus one reason or example; two to four sentences is enough.",
    explanationVi: "Phần 1: trả lời trực tiếp kèm một lý do hoặc ví dụ; hai đến bốn câu là đủ.",
    modelAnswer: model,
    examinerNotes: {
      fluencyCoherence: "Direct answer followed by a reason; no long pauses.",
      lexicalResource: "Everyday vocabulary used precisely (clears my head, deliberate decision).",
      grammaticalRange: "Present, past and comparative forms used accurately.",
      pronunciation: "Natural sentence stress; intonation falls at the end of statements.",
    },
  })),
  {
    importId: "fsa-s-p2",
    skill: "speaking",
    questionType: "speaking_part2_cuecard",
    orderIndex: 4,
    prompt:
      "Describe a place in your town or city that has changed a lot. You should say: what the place is, what it was like before, how it has changed, and explain how you feel about the change.",
    cueCard: {
      topic: "Describe a place in your town or city that has changed a lot.",
      bullets: ["what the place is", "what it was like before", "how it has changed"],
      closing: "and explain how you feel about the change",
      prepSeconds: 60,
      speakSeconds: 120,
    },
    explanationEn: "Part 2: speak for one to two minutes, covering every bullet and finishing with your feelings about the change.",
    explanationVi: "Phần 2: nói trong một đến hai phút, đề cập mọi gạch đầu dòng và kết bằng cảm nhận của bạn về sự thay đổi.",
    modelAnswer:
      "I would like to talk about the old railway yard on the edge of my city. When I was growing up, it was a fenced-off area of rusting sheds and weeds. Trains had stopped using it years before, and the only people who went there were teenagers looking for somewhere to skateboard. About five years ago the council turned it into a park. They kept the two largest sheds and made one into a covered market and the other into a sports hall, and the old tracks became a long, straight cycle path lined with trees. There is a playground where the turntable used to be, and on summer evenings there are food stalls. I have mixed feelings, to be honest. I love that the place is full of life now, and I use the cycle path almost every day. At the same time, the flats built along one side are far too expensive for the families who lived nearby, so some of the people who should benefit most have had to move away. On balance, though, I think the change was a good one.",
    examinerNotes: {
      fluencyCoherence: "Covers all bullets in order and sustains the talk for around two minutes with a clear conclusion.",
      lexicalResource: "Specific, descriptive vocabulary (fenced-off, rusting sheds, turntable, lined with trees) and idiomatic hedging (to be honest, on balance).",
      grammaticalRange: "Narrative past tenses, past perfect, relative clauses and contrastive structures used accurately.",
      pronunciation: "Chunking of longer sentences and stress on contrastive words (love / at the same time).",
    },
  },
  ...SPEAKING_P3.map(([prompt, model], i) => ({
    importId: `fsa-s-p3-${i + 1}`,
    skill: "speaking" as const,
    questionType: "speaking_part3" as const,
    orderIndex: 5 + i,
    prompt,
    explanationEn: "Part 3: give an opinion, justify it, and where possible consider another side or a condition.",
    explanationVi: "Phần 3: nêu ý kiến, giải thích lý do, và nếu có thể xét thêm mặt khác hoặc điều kiện.",
    modelAnswer: model,
    examinerNotes: {
      fluencyCoherence: "Abstract question answered with a position, a reason and a qualification.",
      lexicalResource: "Less common items used naturally (nostalgia, short-sighted, facade, scarce).",
      grammaticalRange: "Conditionals, modal verbs and complex noun phrases handled accurately.",
      pronunciation: "Clear word stress on multi-syllable words; rhythm is natural rather than syllable-timed.",
    },
  })),
];

/* ------------------------------------------------------------------ */
/* Test                                                                */
/* ------------------------------------------------------------------ */

export const FORMAT_SHOWCASE_ACADEMIC: AuthoredTest = {
  slug: "format-showcase-academic",
  title: "Format Showcase — Academic",
  description:
    "Original IELTS Academic full mock that exercises every objective question format, stimulus kind and marking upgrade in the mock player.",
  module: "academic",
  kind: "full_mock",
  bandConversionKey: "default",
  timeLimitSeconds: 10800,
  assets: [
    {
      importId: "map-alder-bank",
      file: "map-alder-bank.svg",
      contentType: "image/svg+xml",
      alt: "Plan of Alder Bank sports park with eight lettered locations A to H.",
    },
    {
      importId: "diagram-streetlight",
      file: "diagram-streetlight.svg",
      contentType: "image/svg+xml",
      alt: "Side view of a full cut-off streetlight with two numbered callouts.",
    },
  ],
  passages,
  listeningSections,
  groups,
  questions: [...listeningQuestions, ...readingQuestions, ...writingQuestions, ...speakingQuestions],
};
