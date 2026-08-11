alter table public.interviews
  add column if not exists communication_grade text,
  add column if not exists professionalism_grade text,
  add column if not exists aba_experience_grade text,
  add column if not exists schedule_flexibility_grade text,
  add column if not exists overall_recommendation_grade text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'interviews_evaluation_grade_check'
      and conrelid = 'public.interviews'::regclass
  ) then
    alter table public.interviews
      add constraint interviews_evaluation_grade_check check (
        (communication_grade is null or communication_grade in ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F')) and
        (professionalism_grade is null or professionalism_grade in ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F')) and
        (aba_experience_grade is null or aba_experience_grade in ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F')) and
        (schedule_flexibility_grade is null or schedule_flexibility_grade in ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F')) and
        (overall_recommendation_grade is null or overall_recommendation_grade in ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'))
      );
  end if;
end $$;