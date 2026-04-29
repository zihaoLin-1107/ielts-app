export type VocabularyBankWord = {
  id: string;
  user_id: string;
  word: string;
  meaning: string;
  example_sentence: string | null;
  source: string | null;
  tags: string[];
  difficulty_level: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserWord = {
  id: string;
  user_id: string;
  vocabulary_bank_id: string;
  word: string;
  meaning: string;
  example_sentence: string | null;
  source: string | null;
  tags: string[];
  familiarity_level: number;
  review_count: number;
  next_review_at: string | null;
  last_reviewed_at: string | null;
  first_learned_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingPack = {
  id: string;
  user_id: string;
  title: string;
  content_markdown: string;
  source_words: string[] | null;
  created_at: string;
  updated_at: string;
};
