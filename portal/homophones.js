/* Faithful extraction of the user-selected source PDF. Printed references are unverified. */
const HOMOPHONE_SETS = [
  {
    "number": 1,
    "words": [
      {
        "word": "Accept",
        "meaning": "To receive or agree to"
      },
      {
        "word": "Except",
        "meaning": "Excluding / Other than"
      }
    ],
    "printedReference": "SSC CGL 2024 / CUET 2024"
  },
  {
    "number": 2,
    "words": [
      {
        "word": "Affect",
        "meaning": "To influence or impact (Verb)"
      },
      {
        "word": "Effect",
        "meaning": "A result or outcome (Noun)"
      }
    ],
    "printedReference": "SSC CGL 2023 / UPPSC 2022"
  },
  {
    "number": 3,
    "words": [
      {
        "word": "Advice",
        "meaning": "An opinion or recommendation (Noun)"
      },
      {
        "word": "Advise",
        "meaning": "To give advice or counsel (Verb)"
      }
    ],
    "printedReference": "CUET English 2024 / SSC CHSL"
  },
  {
    "number": 4,
    "words": [
      {
        "word": "Altar",
        "meaning": "A sacred table or raised structure in church"
      },
      {
        "word": "Alter",
        "meaning": "To change or modify"
      }
    ],
    "printedReference": "UPSC CDS 2023 / MPSC 2022"
  },
  {
    "number": 5,
    "words": [
      {
        "word": "Aloud",
        "meaning": "Spoken out loud so others can hear"
      },
      {
        "word": "Allowed",
        "meaning": "Permitted or given permission"
      }
    ],
    "printedReference": "SSC MTS 2023 / MPPSC 2021"
  },
  {
    "number": 6,
    "words": [
      {
        "word": "Allusion",
        "meaning": "An indirect or casual reference"
      },
      {
        "word": "Illusion",
        "meaning": "A deceptive appearance or false belief"
      },
      {
        "word": "Elusion",
        "meaning": "An act of escaping or evading"
      }
    ],
    "printedReference": "SSC CGL 2022 / IBPS PO 2023"
  },
  {
    "number": 7,
    "words": [
      {
        "word": "Aisle",
        "meaning": "A passage between rows of seats or shelves"
      },
      {
        "word": "Isle",
        "meaning": "A small island"
      },
      {
        "word": "I'll",
        "meaning": "Contraction of 'I will'"
      }
    ],
    "printedReference": "CUET English 2023 / NDA 2022"
  },
  {
    "number": 8,
    "words": [
      {
        "word": "Access",
        "meaning": "Approach or right to enter"
      },
      {
        "word": "Excess",
        "meaning": "More than necessary or desirable"
      }
    ],
    "printedReference": "SSC CPO 2023 / Rajasthan CET"
  },
  {
    "number": 9,
    "words": [
      {
        "word": "Appraise",
        "meaning": "To assess the value or quality of"
      },
      {
        "word": "Apprise",
        "meaning": "To inform or notify someone"
      }
    ],
    "printedReference": "SSC CGL Tier-II / Bank PO 2023"
  },
  {
    "number": 10,
    "words": [
      {
        "word": "Ascent",
        "meaning": "An act of climbing or rising upward"
      },
      {
        "word": "Assent",
        "meaning": "Official agreement or consent"
      }
    ],
    "printedReference": "CUET 2024 / WB PSC 2022"
  },
  {
    "number": 11,
    "words": [
      {
        "word": "Bare",
        "meaning": "Uncovered, basic, or naked"
      },
      {
        "word": "Bear",
        "meaning": "Large animal / To carry or endure"
      }
    ],
    "printedReference": "SSC CHSL 2023 / Bihar STET"
  },
  {
    "number": 12,
    "words": [
      {
        "word": "Brake",
        "meaning": "Device for stopping a vehicle"
      },
      {
        "word": "Break",
        "meaning": "To smash, damage, or take a pause"
      }
    ],
    "printedReference": "CUET 2023 / SSC CGL 2024"
  },
  {
    "number": 13,
    "words": [
      {
        "word": "Berth",
        "meaning": "A reserved sleeping place in a train/ship"
      },
      {
        "word": "Birth",
        "meaning": "The process of coming into life"
      }
    ],
    "printedReference": "CUET English 2024 / RRC RRB 2022"
  },
  {
    "number": 14,
    "words": [
      {
        "word": "Beside",
        "meaning": "By the side of / Next to"
      },
      {
        "word": "Besides",
        "meaning": "In addition to / Apart from"
      }
    ],
    "printedReference": "SSC CGL 2023 / UPPSC 2023"
  },
  {
    "number": 15,
    "words": [
      {
        "word": "Bridal",
        "meaning": "Relating to a bride or a wedding"
      },
      {
        "word": "Bridle",
        "meaning": "Headgear used to control a horse"
      }
    ],
    "printedReference": "UPSC NDA 2023 / MPSC 2021"
  },
  {
    "number": 16,
    "words": [
      {
        "word": "Boar",
        "meaning": "A wild male pig"
      },
      {
        "word": "Bore",
        "meaning": "To drill a hole / To make uninterested"
      },
      {
        "word": "Boer",
        "meaning": "A South African person of Dutch descent"
      }
    ],
    "printedReference": "SSC CGL 2022 / MPPSC 2022"
  },
  {
    "number": 17,
    "words": [
      {
        "word": "Bough",
        "meaning": "A main branch of a tree"
      },
      {
        "word": "Bow",
        "meaning": "To bend head in respect / Weapon for arrows"
      }
    ],
    "printedReference": "UPSC CDS 2022 / Rajasthan CET"
  },
  {
    "number": 18,
    "words": [
      {
        "word": "Canvas",
        "meaning": "Heavy woven cloth for painting/tents"
      },
      {
        "word": "Canvass",
        "meaning": "To solicit votes, opinions, or support"
      }
    ],
    "printedReference": "CUET English 2024 / SSC CGL 2023"
  },
  {
    "number": 19,
    "words": [
      {
        "word": "Capital",
        "meaning": "Chief city / Investment funds / Uppercase"
      },
      {
        "word": "Capitol",
        "meaning": "A building where a legislature meets"
      }
    ],
    "printedReference": "CUET 2023 / SSC CGL 2024"
  },
  {
    "number": 20,
    "words": [
      {
        "word": "Cast",
        "meaning": "To throw / Select actors for a play"
      },
      {
        "word": "Caste",
        "meaning": "A social class or hereditary group"
      }
    ],
    "printedReference": "SSC CHSL 2022 / WB PSC 2023"
  },
  {
    "number": 21,
    "words": [
      {
        "word": "Censor",
        "meaning": "To ban or suppress unacceptable parts"
      },
      {
        "word": "Sensor",
        "meaning": "A device that detects physical inputs"
      },
      {
        "word": "Censure",
        "meaning": "To express severe disapproval or criticize"
      }
    ],
    "printedReference": "SSC CGL Tier-II 2023 / IBPS PO"
  },
  {
    "number": 22,
    "words": [
      {
        "word": "Cereal",
        "meaning": "Grain used for food (e.g. wheat, oats)"
      },
      {
        "word": "Serial",
        "meaning": "Occurring in a series or sequential order"
      }
    ],
    "printedReference": "CUET 2024 / RRC RRB 2023"
  },
  {
    "number": 23,
    "words": [
      {
        "word": "Check",
        "meaning": "To verify or examine / Cheque (US spelling)"
      },
      {
        "word": "Cheque",
        "meaning": "A written order to a bank to pay money"
      }
    ],
    "printedReference": "CUET English 2024 / Bank Clerk"
  },
  {
    "number": 24,
    "words": [
      {
        "word": "Chord",
        "meaning": "A group of musical notes sounded together"
      },
      {
        "word": "Cord",
        "meaning": "A thin rope, string, or electrical wire"
      }
    ],
    "printedReference": "SSC CPO 2022 / UPPSC 2021"
  },
  {
    "number": 25,
    "words": [
      {
        "word": "Coarse",
        "meaning": "Rough, harsh, or crude in texture/language"
      },
      {
        "word": "Course",
        "meaning": "A direction, route, or academic study"
      }
    ],
    "printedReference": "CUET 2024 / SSC CHSL 2023"
  },
  {
    "number": 26,
    "words": [
      {
        "word": "Compliment",
        "meaning": "A statement or act of praise"
      },
      {
        "word": "Complement",
        "meaning": "Something that completes or brings to perfection"
      }
    ],
    "printedReference": "SSC CHSL 2023 / CUET 2024"
  },
  {
    "number": 27,
    "words": [
      {
        "word": "Council",
        "meaning": "An administrative or advisory body of people"
      },
      {
        "word": "Counsel",
        "meaning": "Advice or guidance / A legal barrister"
      }
    ],
    "printedReference": "CUET English 2023 / SSC CGL 2023"
  },
  {
    "number": 28,
    "words": [
      {
        "word": "Cannon",
        "meaning": "A heavy military artillery gun"
      },
      {
        "word": "Canon",
        "meaning": "A general rule, law, or accepted principle"
      }
    ],
    "printedReference": "UPSC NDA 2023 / MPSC 2022"
  },
  {
    "number": 29,
    "words": [
      {
        "word": "Collision",
        "meaning": "An instance of one moving object crashing"
      },
      {
        "word": "Collusion",
        "meaning": "Secret or illegal cooperation/conspiracy"
      }
    ],
    "printedReference": "SSC CGL 2022 / Bank PO 2023"
  },
  {
    "number": 30,
    "words": [
      {
        "word": "Command",
        "meaning": "An order given authoritatively"
      },
      {
        "word": "Commend",
        "meaning": "To praise formally or officially"
      }
    ],
    "printedReference": "SSC CGL 2024 / MPPSC 2023"
  },
  {
    "number": 31,
    "words": [
      {
        "word": "Defer",
        "meaning": "To postpone or delay"
      },
      {
        "word": "Differ",
        "meaning": "To be unlike or hold a different opinion"
      }
    ],
    "printedReference": "UPSC CDS 2023 / Rajasthan CET"
  },
  {
    "number": 32,
    "words": [
      {
        "word": "Deasease",
        "meaning": "Death or demise (legal context: decease)"
      },
      {
        "word": "Disease",
        "meaning": "A illness or medical condition"
      },
      {
        "word": "Deceit",
        "meaning": "The act of misleading or cheating"
      }
    ],
    "printedReference": "SSC CPO 2022 / WB PSC"
  },
  {
    "number": 33,
    "words": [
      {
        "word": "Desert",
        "meaning": "Dry barren land (n) / To abandon (v)"
      },
      {
        "word": "Dessert",
        "meaning": "Sweet food served at the end of a meal"
      }
    ],
    "printedReference": "CUET 2024 / SSC CGL 2023"
  },
  {
    "number": 34,
    "words": [
      {
        "word": "Device",
        "meaning": "A tool, machine, or invention (Noun)"
      },
      {
        "word": "Devise",
        "meaning": "To plan, invent, or create (Verb)"
      }
    ],
    "printedReference": "CUET English 2023 / SSC CHSL"
  },
  {
    "number": 35,
    "words": [
      {
        "word": "Discrete",
        "meaning": "Individually separate and distinct"
      },
      {
        "word": "Discreet",
        "meaning": "Careful, prudent, and keeping secrets"
      }
    ],
    "printedReference": "SSC CGL 2024 / CAT / Bank PO"
  },
  {
    "number": 36,
    "words": [
      {
        "word": "Dual",
        "meaning": "Consisting of two parts or double"
      },
      {
        "word": "Duel",
        "meaning": "A formal combat between two people"
      }
    ],
    "printedReference": "CUET English 2024 / SSC CGL 2022"
  },
  {
    "number": 37,
    "words": [
      {
        "word": "Dye",
        "meaning": "To add color to hair or fabric"
      },
      {
        "word": "Die",
        "meaning": "To stop living / A small cube with dots"
      }
    ],
    "printedReference": "SSC MTS 2022 / UPPSC 2022"
  },
  {
    "number": 38,
    "words": [
      {
        "word": "Elicit",
        "meaning": "To evoke, draw out, or prompt a response"
      },
      {
        "word": "Illicit",
        "meaning": "Forbidden by law, rules, or custom"
      }
    ],
    "printedReference": "SSC CGL 2023 / UPSC CDS 2023"
  },
  {
    "number": 39,
    "words": [
      {
        "word": "Eminent",
        "meaning": "Famous, respected, and prominent"
      },
      {
        "word": "Imminent",
        "meaning": "About to happen very soon"
      },
      {
        "word": "Immanent",
        "meaning": "Existing or remaining within; inherent"
      }
    ],
    "printedReference": "CUET 2024 / SSC CGL 2024"
  },
  {
    "number": 40,
    "words": [
      {
        "word": "Emigrate",
        "meaning": "To leave one's own country permanently"
      },
      {
        "word": "Immigrate",
        "meaning": "To come to live permanently in a foreign country"
      }
    ],
    "printedReference": "CUET English 2023 / SSC CPO 2023"
  },
  {
    "number": 41,
    "words": [
      {
        "word": "Faint",
        "meaning": "Weak or dizzy / To lose consciousness"
      },
      {
        "word": "Feint",
        "meaning": "A deceptive or pretended blow/attack"
      }
    ],
    "printedReference": "UPSC NDA 2022 / MPSC 2023"
  },
  {
    "number": 42,
    "words": [
      {
        "word": "Fair",
        "meaning": "Equitable / Light-complexioned / Carnival"
      },
      {
        "word": "Fare",
        "meaning": "Transportation charge / Food supply"
      }
    ],
    "printedReference": "CUET 2024 / SSC CHSL 2022"
  },
  {
    "number": 43,
    "words": [
      {
        "word": "Feet",
        "meaning": "Plural of foot"
      },
      {
        "word": "Feat",
        "meaning": "An achievement requiring skill or courage"
      }
    ],
    "printedReference": "SSC CGL 2022 / MPPSC 2021"
  },
  {
    "number": 44,
    "words": [
      {
        "word": "Flair",
        "meaning": "A natural talent or stylish aptness"
      },
      {
        "word": "Flare",
        "meaning": "A sudden burst of flame/light or emotion"
      }
    ],
    "printedReference": "SSC CGL 2023 / Bank PO 2022"
  },
  {
    "number": 45,
    "words": [
      {
        "word": "Flea",
        "meaning": "A small wingless jumping insect"
      },
      {
        "word": "Flee",
        "meaning": "To run away from danger or pursuit"
      }
    ],
    "printedReference": "CUET 2023 / RRC RRB 2023"
  },
  {
    "number": 46,
    "words": [
      {
        "word": "Flour",
        "meaning": "Powder obtained by grinding grain"
      },
      {
        "word": "Flower",
        "meaning": "The seed-bearing part of a plant"
      }
    ],
    "printedReference": "SSC MTS 2023 / Rajasthan CET"
  },
  {
    "number": 47,
    "words": [
      {
        "word": "Forth",
        "meaning": "Forward into view or onward in time"
      },
      {
        "word": "Fourth",
        "meaning": "Number 4 in a sequence"
      }
    ],
    "printedReference": "CUET English 2024 / SSC CHSL"
  },
  {
    "number": 48,
    "words": [
      {
        "word": "Foul",
        "meaning": "Offensive, dirty, or breaking rules"
      },
      {
        "word": "Fowl",
        "meaning": "A bird raised for food (e.g. hen, duck)"
      }
    ],
    "printedReference": "SSC CGL 2023 / WB PSC 2022"
  },
  {
    "number": 49,
    "words": [
      {
        "word": "Gait",
        "meaning": "A person's manner or style of walking"
      },
      {
        "word": "Gate",
        "meaning": "A hinged barrier used to close an opening"
      }
    ],
    "printedReference": "CUET 2024 / UPSC CDS 2023"
  },
  {
    "number": 50,
    "words": [
      {
        "word": "Grate",
        "meaning": "To shred food / Make a harsh grinding sound"
      },
      {
        "word": "Great",
        "meaning": "Very large or impressive in quality"
      }
    ],
    "printedReference": "SSC CPO 2023 / UPPSC 2022"
  },
  {
    "number": 51,
    "words": [
      {
        "word": "Grizzly",
        "meaning": "A large greyish-brown bear"
      },
      {
        "word": "Grisly",
        "meaning": "Causing horror or disgust; gruesome"
      }
    ],
    "printedReference": "UPSC NDA 2023 / MPSC 2023"
  },
  {
    "number": 52,
    "words": [
      {
        "word": "Hail",
        "meaning": "Frozen rain pellets / To greet or acclaim"
      },
      {
        "word": "Hale",
        "meaning": "Strong, healthy, and vigorous"
      }
    ],
    "printedReference": "SSC CGL 2022 / Bihar STET 2023"
  },
  {
    "number": 53,
    "words": [
      {
        "word": "Hair",
        "meaning": "Strands growing on the skin of mammals"
      },
      {
        "word": "Hare",
        "meaning": "A fast mammal resembling a rabbit"
      },
      {
        "word": "Heir",
        "meaning": "A person legally entitled to property"
      }
    ],
    "printedReference": "CUET English 2023 / SSC CGL 2024"
  },
  {
    "number": 54,
    "words": [
      {
        "word": "Hall",
        "meaning": "A corridor or large reception room"
      },
      {
        "word": "Haul",
        "meaning": "To pull or drag with effort"
      }
    ],
    "printedReference": "SSC CHSL 2022 / RRC RRB 2022"
  },
  {
    "number": 55,
    "words": [
      {
        "word": "Hangar",
        "meaning": "A large shed for housing aircraft"
      },
      {
        "word": "Hanger",
        "meaning": "A device on which clothes are hung"
      }
    ],
    "printedReference": "CUET 2024 / SSC CGL 2023"
  },
  {
    "number": 56,
    "words": [
      {
        "word": "Heal",
        "meaning": "To become sound or healthy again"
      },
      {
        "word": "Heel",
        "meaning": "The back part of the human foot"
      },
      {
        "word": "He'll",
        "meaning": "Contraction of 'he will'"
      }
    ],
    "printedReference": "SSC MTS 2023 / MPPSC 2022"
  },
  {
    "number": 57,
    "words": [
      {
        "word": "Hear",
        "meaning": "To perceive sound with the ear"
      },
      {
        "word": "Here",
        "meaning": "In, at, or to this place"
      }
    ],
    "printedReference": "CUET English 2024 / SSC CGL 2024"
  },
  {
    "number": 58,
    "words": [
      {
        "word": "Herd",
        "meaning": "A large group of animals"
      },
      {
        "word": "Heard",
        "meaning": "Past tense of hear"
      }
    ],
    "printedReference": "SSC CGL 2023 / UPPSC 2023"
  },
  {
    "number": 59,
    "words": [
      {
        "word": "Hoard",
        "meaning": "To store up a secret supply or stockpile"
      },
      {
        "word": "Horde",
        "meaning": "A large, unorganized group or crowd"
      }
    ],
    "printedReference": "SSC CGL 2024 / Bank PO 2023"
  },
  {
    "number": 60,
    "words": [
      {
        "word": "Hoarse",
        "meaning": "Rough and harsh sounding voice"
      },
      {
        "word": "Horse",
        "meaning": "A large domesticated four-legged mammal"
      }
    ],
    "printedReference": "CUET 2023 / WB PSC 2021"
  },
  {
    "number": 61,
    "words": [
      {
        "word": "Hole",
        "meaning": "An opening or hollow place"
      },
      {
        "word": "Whole",
        "meaning": "Entire, complete, or undivided"
      }
    ],
    "printedReference": "SSC CPO 2022 / Rajasthan CET"
  },
  {
    "number": 62,
    "words": [
      {
        "word": "Holy",
        "meaning": "Sacred or dedicated to God"
      },
      {
        "word": "Wholly",
        "meaning": "Completely or fully"
      },
      {
        "word": "Holly",
        "meaning": "An evergreen plant with prickly leaves and red berries"
      }
    ],
    "printedReference": "UPSC CDS 2023 / MPSC 2022"
  },
  {
    "number": 63,
    "words": [
      {
        "word": "Human",
        "meaning": "Relating to or characteristic of people"
      },
      {
        "word": "Humane",
        "meaning": "Having or showing compassion and benevolence"
      }
    ],
    "printedReference": "CUET English 2024 / SSC CGL 2023"
  },
  {
    "number": 64,
    "words": [
      {
        "word": "Idle",
        "meaning": "Not active, unemployed, or lazy"
      },
      {
        "word": "Idol",
        "meaning": "An image worshipped as a god or admired person"
      },
      {
        "word": "Idyll",
        "meaning": "An extremely happy, peaceful episode or scene"
      }
    ],
    "printedReference": "SSC CGL Tier-II 2023 / IBPS PO"
  },
  {
    "number": 65,
    "words": [
      {
        "word": "Incite",
        "meaning": "To encourage or stir up violent behavior"
      },
      {
        "word": "Insight",
        "meaning": "An accurate and deep understanding"
      }
    ],
    "printedReference": "SSC CGL 2024 / CUET English 2024"
  },
  {
    "number": 66,
    "words": [
      {
        "word": "Knight",
        "meaning": "A medieval soldier of noble rank"
      },
      {
        "word": "Night",
        "meaning": "The period of darkness between sunset and sunrise"
      }
    ],
    "printedReference": "CUET 2023 / SSC CHSL 2022"
  },
  {
    "number": 67,
    "words": [
      {
        "word": "Knot",
        "meaning": "A fastening made by tying string/rope"
      },
      {
        "word": "Not",
        "meaning": "Used to express negation"
      }
    ],
    "printedReference": "SSC MTS 2022 / UPPSC 2022"
  },
  {
    "number": 68,
    "words": [
      {
        "word": "Know",
        "meaning": "To possess knowledge or be aware"
      },
      {
        "word": "No",
        "meaning": "Used to give a negative response"
      }
    ],
    "printedReference": "CUET English 2024 / SSC CGL 2024"
  },
  {
    "number": 69,
    "words": [
      {
        "word": "Lead",
        "meaning": "A heavy toxic metal element (Noun)"
      },
      {
        "word": "Led",
        "meaning": "Past tense of lead (Verb)"
      }
    ],
    "printedReference": "SSC CGL 2023 / MPPSC 2023"
  },
  {
    "number": 70,
    "words": [
      {
        "word": "Lessen",
        "meaning": "To make or become less or diminish"
      },
      {
        "word": "Lesson",
        "meaning": "A period of learning or instruction"
      }
    ],
    "printedReference": "CUET 2024 / SSC CPO 2023"
  },
  {
    "number": 71,
    "words": [
      {
        "word": "Loose",
        "meaning": "Not firmly fixed, fitting, or tied"
      },
      {
        "word": "Lose",
        "meaning": "To be deprived of or fail to win"
      },
      {
        "word": "Loss",
        "meaning": "The fact of losing something (Noun)"
      }
    ],
    "printedReference": "CUET English 2024 / SSC CGL 2024"
  },
  {
    "number": 72,
    "words": [
      {
        "word": "Made",
        "meaning": "Past tense of make"
      },
      {
        "word": "Maid",
        "meaning": "A female domestic worker or servant"
      }
    ],
    "printedReference": "SSC CHSL 2023 / WB PSC 2022"
  },
  {
    "number": 73,
    "words": [
      {
        "word": "Mail",
        "meaning": "Letters and packages sent by post"
      },
      {
        "word": "Male",
        "meaning": "Relating to the sex that produces sperm"
      }
    ],
    "printedReference": "CUET 2023 / Rajasthan CET 2023"
  },
  {
    "number": 74,
    "words": [
      {
        "word": "Marry",
        "meaning": "To take in marriage or unite as spouses"
      },
      {
        "word": "Merry",
        "meaning": "Cheerful and lively; joyous"
      },
      {
        "word": "Mary",
        "meaning": "A proper female name"
      }
    ],
    "printedReference": "SSC CGL 2022 / UPSC NDA 2022"
  },
  {
    "number": 75,
    "words": [
      {
        "word": "Meat",
        "meaning": "Flesh of an animal used as food"
      },
      {
        "word": "Meet",
        "meaning": "To come into the presence of someone"
      },
      {
        "word": "Mete",
        "meaning": "To allot or distribute (punishment/justice)"
      }
    ],
    "printedReference": "CUET English 2024 / SSC CGL 2024"
  },
  {
    "number": 76,
    "words": [
      {
        "word": "Medal",
        "meaning": "A metal disc awarded for achievement"
      },
      {
        "word": "Meddle",
        "meaning": "To interfere in something that is not one's concern"
      },
      {
        "word": "Mettle",
        "meaning": "A person's ability to cope with difficulties"
      }
    ],
    "printedReference": "SSC CGL Tier-II 2023 / Bank PO"
  },
  {
    "number": 77,
    "words": [
      {
        "word": "Miner",
        "meaning": "A person who works in a mine extracting ore"
      },
      {
        "word": "Minor",
        "meaning": "Lesser in importance / A person under 18"
      }
    ],
    "printedReference": "CUET 2024 / MPSC 2023"
  },
  {
    "number": 78,
    "words": [
      {
        "word": "Moral",
        "meaning": "Concerned with principles of right and wrong"
      },
      {
        "word": "Morale",
        "meaning": "The confidence, enthusiasm, and spirit of a group"
      }
    ],
    "printedReference": "SSC CGL 2024 / IBPS PO 2023"
  },
  {
    "number": 79,
    "words": [
      {
        "word": "Morning",
        "meaning": "The early part of the day before noon"
      },
      {
        "word": "Mourning",
        "meaning": "The expression of deep sorrow for a death"
      }
    ],
    "printedReference": "CUET English 2023 / SSC CPO 2022"
  },
  {
    "number": 80,
    "words": [
      {
        "word": "Naval",
        "meaning": "Relating to a navy or military ships"
      },
      {
        "word": "Navel",
        "meaning": "The belly button or central point"
      }
    ],
    "printedReference": "UPSC CDS 2023 / UPPSC 2023"
  },
  {
    "number": 81,
    "words": [
      {
        "word": "Oar",
        "meaning": "A pole used for rowing a boat"
      },
      {
        "word": "Ore",
        "meaning": "Naturally occurring solid material containing metal"
      },
      {
        "word": "Or",
        "meaning": "Conjunction indicating an alternative"
      }
    ],
    "printedReference": "SSC CGL 2022 / MPPSC 2022"
  },
  {
    "number": 82,
    "words": [
      {
        "word": "Pain",
        "meaning": "Physical suffering or discomfort"
      },
      {
        "word": "Pane",
        "meaning": "A single sheet of glass in a window frame"
      }
    ],
    "printedReference": "CUET 2024 / SSC CHSL 2023"
  },
  {
    "number": 83,
    "words": [
      {
        "word": "Pair",
        "meaning": "A set of two related things"
      },
      {
        "word": "Pear",
        "meaning": "A sweet, juicy yellowish-green fruit"
      },
      {
        "word": "Pare",
        "meaning": "To trim off the outer layer or skin"
      }
    ],
    "printedReference": "CUET English 2023 / WB PSC 2023"
  },
  {
    "number": 84,
    "words": [
      {
        "word": "Passed",
        "meaning": "Past tense of pass (went by / succeeded)"
      },
      {
        "word": "Past",
        "meaning": "Gone by in time / Former time"
      }
    ],
    "printedReference": "SSC CGL 2023 / Rajasthan CET 2022"
  },
  {
    "number": 85,
    "words": [
      {
        "word": "Peace",
        "meaning": "Freedom from disturbance or war"
      },
      {
        "word": "Piece",
        "meaning": "A portion or section of a whole"
      }
    ],
    "printedReference": "CUET English 2024 / SSC CGL 2024"
  },
  {
    "number": 86,
    "words": [
      {
        "word": "Peak",
        "meaning": "The pointed top of a mountain / Highest point"
      },
      {
        "word": "Peek",
        "meaning": "A quick or furtive look"
      },
      {
        "word": "Pique",
        "meaning": "To stimulate interest or irritate"
      }
    ],
    "printedReference": "SSC CGL Tier-II 2023 / Bank PO"
  },
  {
    "number": 87,
    "words": [
      {
        "word": "Plain",
        "meaning": "Simple / A large area of flat land"
      },
      {
        "word": "Plane",
        "meaning": "An airplane / A flat level surface"
      }
    ],
    "printedReference": "CUET 2024 / SSC CHSL 2023"
  },
  {
    "number": 88,
    "words": [
      {
        "word": "Pour",
        "meaning": "To flow or cause a liquid to flow"
      },
      {
        "word": "Poor",
        "meaning": "Lacking money or acceptable quality"
      },
      {
        "word": "Pore",
        "meaning": "Tiny opening in skin (n) / Study attentively (v)"
      }
    ],
    "printedReference": "SSC CPO 2023 / UPSC NDA 2023"
  },
  {
    "number": 89,
    "words": [
      {
        "word": "Pray",
        "meaning": "To address a solemn request to God"
      },
      {
        "word": "Prey",
        "meaning": "An animal hunted and killed for food"
      }
    ],
    "printedReference": "CUET English 2023 / MPSC 2022"
  },
  {
    "number": 90,
    "words": [
      {
        "word": "Principal",
        "meaning": "Head of a school / Main sum of money"
      },
      {
        "word": "Principle",
        "meaning": "A fundamental truth, rule, or belief"
      }
    ],
    "printedReference": "CUET 2024 / SSC CGL 2024"
  },
  {
    "number": 91,
    "words": [
      {
        "word": "Quiet",
        "meaning": "Making little or no noise"
      },
      {
        "word": "Quite",
        "meaning": "To a utmost degree; completely or fairly"
      },
      {
        "word": "Quit",
        "meaning": "To stop, leave, or resign"
      }
    ],
    "printedReference": "CUET English 2024 / SSC CGL 2023"
  },
  {
    "number": 92,
    "words": [
      {
        "word": "Rain",
        "meaning": "Water falling in drops from clouds"
      },
      {
        "word": "Reign",
        "meaning": "Period of rule by a monarch"
      },
      {
        "word": "Rein",
        "meaning": "Leather strap used to guide a horse"
      }
    ],
    "printedReference": "SSC CGL 2024 / UPSC CDS 2023"
  },
  {
    "number": 93,
    "words": [
      {
        "word": "Raise",
        "meaning": "To lift up or elevate / Increase"
      },
      {
        "word": "Rays",
        "meaning": "Beams of light or radiation"
      },
      {
        "word": "Raze",
        "meaning": "To completely destroy or level a building"
      }
    ],
    "printedReference": "SSC CGL Tier-II 2023 / Bank PO"
  },
  {
    "number": 94,
    "words": [
      {
        "word": "Right",
        "meaning": "Correct / Direction opposite left / Legal claim"
      },
      {
        "word": "Write",
        "meaning": "To mark letters/words on paper"
      },
      {
        "word": "Rite",
        "meaning": "A formal or ceremonial religious act"
      }
    ],
    "printedReference": "SSC CGL 2024 / CUET English 2024"
  },
  {
    "number": 95,
    "words": [
      {
        "word": "Role",
        "meaning": "An actor's part / Function in a situation"
      },
      {
        "word": "Roll",
        "meaning": "To turn over / A small rounded bread loaf"
      }
    ],
    "printedReference": "CUET 2023 / SSC CHSL 2022"
  },
  {
    "number": 96,
    "words": [
      {
        "word": "Root",
        "meaning": "The underground part of a plant"
      },
      {
        "word": "Route",
        "meaning": "A way or course taken in traveling"
      },
      {
        "word": "Rout",
        "meaning": "A decisive defeat or disorderly retreat"
      }
    ],
    "printedReference": "SSC CPO 2023 / UPPSC 2023"
  },
  {
    "number": 97,
    "words": [
      {
        "word": "Sail",
        "meaning": "Cloth used to catch wind on a boat"
      },
      {
        "word": "Sale",
        "meaning": "The exchange of goods for money"
      }
    ],
    "printedReference": "CUET English 2024 / WB PSC 2022"
  },
  {
    "number": 98,
    "words": [
      {
        "word": "Stationary",
        "meaning": "Not moving; staying in one fixed place"
      },
      {
        "word": "Stationery",
        "meaning": "Writing materials like paper and pens"
      }
    ],
    "printedReference": "CUET 2024 / SSC CGL 2024 (Shift 1)"
  },
  {
    "number": 99,
    "words": [
      {
        "word": "Vain",
        "meaning": "Having an excessively high opinion / Futile"
      },
      {
        "word": "Vein",
        "meaning": "Blood vessel / A narrow seam of ore"
      },
      {
        "word": "Vane",
        "meaning": "A revolving blade showing wind direction"
      }
    ],
    "printedReference": "UPSC CDS 2023 / SSC CGL 2023"
  },
  {
    "number": 100,
    "words": [
      {
        "word": "Waist",
        "meaning": "The part of the human body above the hips"
      },
      {
        "word": "Waste",
        "meaning": "To use carelessly / Unused material"
      }
    ],
    "printedReference": "CUET English 2024 / SSC CGL 2024"
  }
];
