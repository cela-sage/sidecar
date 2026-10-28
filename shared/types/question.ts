export interface QuestionOption {
  label: string;
  description?: string;
}

export interface Question {
  question: string;
  header?: string;
  multi?: true;
  options: QuestionOption[];
}
