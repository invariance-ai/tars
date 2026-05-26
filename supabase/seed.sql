-- Sample anonymized contribution for local dev / Studio inspection.
-- Shows the exact shape that leaves a contributor's machine: structure only, no content.
do $$
declare
  uid uuid := '00000000-0000-0000-0000-0000000000aa';
  cid uuid;
begin
  -- A stub auth user so the foreign key resolves locally.
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'seed@example.test', now(), now())
    on conflict (id) do nothing;

  insert into public.tars_contributors (user_id)
    values (uid) on conflict (user_id) do nothing;
  select id into cid from public.tars_contributors where user_id = uid;

  insert into public.tars_contributions
    (contributor_id, surface, tars_version, schema_version, framing, approach, positive, duration_bucket)
  values (
    cid, 'claude', '0.1.0', 1,
    '{"promptLen":"medium","hasGoal":true,"hasConstraints":true,"acceptanceCriteriaPresent":true,"decompositionSteps":3,"clarifyingQuestions":false,"examplesGiven":true}'::jsonb,
    '{"strategy":"plan_first","phaseSequence":["frame","explore","edit","test","stop"],"toolActionCounts":{"edit":4,"write":1,"read":6,"test":2,"shell":1,"other":0},"backtrackCount":0,"planBeforeEdit":true}'::jsonb,
    '{"score":0.9,"reasons":["clean stop","tests passed","low rework","coherent framing"],"testsPassed":true,"cleanStop":true,"reworkRatio":0,"userApproved":false,"coherentFraming":true}'::jsonb,
    '5-30m'
  );
end $$;
