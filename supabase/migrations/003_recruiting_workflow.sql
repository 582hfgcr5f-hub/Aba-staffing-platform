alter table public.interviews
  add column if not exists years_aba integer,
  add column if not exists years_rbt integer,
  add column if not exists in_home_experience boolean,
  add column if not exists clinic_experience boolean,
  add column if not exists severe_behaviors_experience boolean,
  add column if not exists preferred_age_group text,
  add column if not exists earliest_start_date date,
  add column if not exists certifications text[] not null default '{}',
  add column if not exists certification_other text,
  add column if not exists skills text[] not null default '{}',
  add column if not exists skill_other text,
  add column if not exists communication_score smallint,
  add column if not exists professionalism_score smallint,
  add column if not exists aba_experience_score smallint,
  add column if not exists schedule_flexibility_score smallint,
  add column if not exists overall_recommendation_score smallint,
  add column if not exists offer_pay text,
  add column if not exists offer_notes text,
  add column if not exists offer_date timestamptz;

alter table public.technicians
  add column if not exists years_aba integer,
  add column if not exists years_rbt integer,
  add column if not exists in_home_experience boolean,
  add column if not exists clinic_experience boolean,
  add column if not exists severe_behaviors_experience boolean,
  add column if not exists preferred_age_group text,
  add column if not exists skills text[] not null default '{}',
  add column if not exists certification_other text,
  add column if not exists skill_other text;

alter table public.interviews
  drop constraint if exists interviews_rating_check,
  add constraint interviews_rating_check check (rating is null or rating in ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F')),
  drop constraint if exists interviews_evaluation_score_check,
  add constraint interviews_evaluation_score_check check (
    (communication_score is null or communication_score between 1 and 5) and
    (professionalism_score is null or professionalism_score between 1 and 5) and
    (aba_experience_score is null or aba_experience_score between 1 and 5) and
    (schedule_flexibility_score is null or schedule_flexibility_score between 1 and 5) and
    (overall_recommendation_score is null or overall_recommendation_score between 1 and 5)
  );