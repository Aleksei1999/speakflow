export interface Question {
  id: string
  category: 'grammar' | 'vocabulary' | 'reading'
  difficulty: 'Raw' | 'Rare' | 'Medium Rare' | 'Medium' | 'Medium Well'
  question: string
  passage?: string
  options: string[]
  correctAnswer: number
  explanation?: string
}

export const questions: Question[] = [
  // ===== GRAMMAR (5 questions) =====
  {
    id: 'g1',
    category: 'grammar',
    difficulty: 'Raw',
    question: 'She ___ to school every day.',
    options: ['go', 'goes', 'going', 'gone'],
    correctAnswer: 1,
    explanation: 'Third person singular requires "goes" in Present Simple.',
  },
  {
    id: 'g2',
    category: 'grammar',
    difficulty: 'Rare',
    question: 'I ___ my homework when my friend called.',
    options: ['did', 'was doing', 'have done', 'do'],
    correctAnswer: 1,
    explanation: 'Past Continuous is used for an action in progress interrupted by another event.',
  },
  {
    id: 'g3',
    category: 'grammar',
    difficulty: 'Medium Rare',
    question: 'If I ___ enough money, I would travel around the world.',
    options: ['have', 'had', 'will have', 'would have'],
    correctAnswer: 1,
    explanation: 'Second conditional uses Past Simple in the if-clause.',
  },
  {
    id: 'g4',
    category: 'grammar',
    difficulty: 'Medium',
    question: 'Not until the meeting ended ___ the true extent of the problem.',
    options: [
      'I realized',
      'did I realize',
      'I did realize',
      'had I realized',
    ],
    correctAnswer: 1,
    explanation:
      '"Not until" at the start of a sentence triggers subject-auxiliary inversion.',
  },
  {
    id: 'g5',
    category: 'grammar',
    difficulty: 'Medium Well',
    question:
      'Had the government acted sooner, the crisis ___ averted.',
    options: [
      'would be',
      'will have been',
      'could have been',
      'can be',
    ],
    correctAnswer: 2,
    explanation:
      'Third conditional with inverted "had" requires "could/would have + past participle".',
  },

  // ===== VOCABULARY (5 questions) =====
  {
    id: 'v1',
    category: 'vocabulary',
    difficulty: 'Raw',
    question: 'What is the opposite of "hot"?',
    options: ['warm', 'cold', 'cool', 'wet'],
    correctAnswer: 1,
    explanation: '"Cold" is the direct antonym of "hot".',
  },
  {
    id: 'v2',
    category: 'vocabulary',
    difficulty: 'Rare',
    question: 'Choose the correct word: "I need to ___ an appointment with the doctor."',
    options: ['do', 'make', 'take', 'have'],
    correctAnswer: 1,
    explanation: 'The collocation is "make an appointment".',
  },
  {
    id: 'v3',
    category: 'vocabulary',
    difficulty: 'Medium Rare',
    question: 'The project was a huge success ___ all the difficulties we faced.',
    options: ['although', 'despite', 'however', 'whereas'],
    correctAnswer: 1,
    explanation: '"Despite" is followed by a noun phrase, not a clause.',
  },
  {
    id: 'v4',
    category: 'vocabulary',
    difficulty: 'Medium',
    question: 'The new policy had far-reaching ___ for the entire industry.',
    options: ['results', 'implications', 'conclusions', 'outputs'],
    correctAnswer: 1,
    explanation:
      '"Implications" means consequences or effects, often indirect ones.',
  },
  {
    id: 'v5',
    category: 'vocabulary',
    difficulty: 'Medium Well',
    question:
      'The politician tried to ___ responsibility for the scandal.',
    options: ['evade', 'avoid', 'prevent', 'escape'],
    correctAnswer: 0,
    explanation:
      '"Evade responsibility" is the precise collocation meaning to deliberately dodge accountability.',
  },

  // ===== READING COMPREHENSION (5 questions) =====
  {
    id: 'r1',
    category: 'reading',
    difficulty: 'Raw',
    passage:
      'Tom is a student. He is 20 years old. He lives in London. He likes playing football and reading books.',
    question: 'What does Tom like doing?',
    options: [
      'Cooking and swimming',
      'Playing football and reading',
      'Watching TV and running',
      'Drawing and singing',
    ],
    correctAnswer: 1,
  },
  {
    id: 'r2',
    category: 'reading',
    difficulty: 'Rare',
    passage:
      'Last weekend, Sarah visited her grandmother in the countryside. They baked a cake together and went for a long walk by the river. Sarah felt very relaxed after her visit.',
    question: 'How did Sarah feel after visiting her grandmother?',
    options: ['Tired', 'Relaxed', 'Bored', 'Excited'],
    correctAnswer: 1,
  },
  {
    id: 'r3',
    category: 'reading',
    difficulty: 'Medium Rare',
    passage:
      'Scientists have discovered that spending time in nature can significantly reduce stress levels. A study conducted across several European countries found that people who spent at least two hours per week in green spaces reported better health and well-being than those who did not.',
    question: 'According to the study, how much time in nature is beneficial?',
    options: [
      'One hour per day',
      'At least two hours per week',
      'Thirty minutes daily',
      'Five hours per month',
    ],
    correctAnswer: 1,
  },
  {
    id: 'r4',
    category: 'reading',
    difficulty: 'Medium',
    passage:
      'The rise of remote work has fundamentally altered urban landscapes. City centres that once thrived on commuter traffic have seen declining foot traffic, while suburban areas have experienced a boom in local businesses. Some economists argue this shift may permanently reshape how cities function, though others believe a hybrid model will eventually restore some balance.',
    question: 'What is the main point of this passage?',
    options: [
      'Remote work is damaging the economy',
      'Suburban businesses are more profitable than urban ones',
      'Remote work is changing the dynamics between city centres and suburbs',
      'Economists agree on the future of urban planning',
    ],
    correctAnswer: 2,
  },
  {
    id: 'r5',
    category: 'reading',
    difficulty: 'Medium Well',
    passage:
      'The concept of neuroplasticity has overturned the long-held belief that the adult brain is essentially fixed. Research now demonstrates that neural pathways can be reorganized throughout life in response to learning, experience, and even injury. This has profound implications for rehabilitation medicine, suggesting that targeted therapies can help patients recover functions previously thought to be permanently lost. However, the extent to which neuroplasticity can compensate for severe damage remains a subject of ongoing debate.',
    question:
      'What does the passage imply about the limits of neuroplasticity?',
    options: [
      'Neuroplasticity can fully restore all brain functions after any injury',
      'The brain cannot change after childhood',
      'There is still uncertainty about how much neuroplasticity can compensate for severe damage',
      'Rehabilitation medicine has no use for neuroplasticity research',
    ],
    correctAnswer: 2,
  },
]
