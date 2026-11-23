# Progression ladders

Steps run easiest first. Each step is an exercise id from `calisthenics.json` (or `CHINUPS`/`DIPS` from `src/exercises.json`). A step with no scheme uses the program slot's own scheme. `band` marks a band-assisted step; `after: weighted` means the ladder ends in added-load work.

Scheme format: `NxM` fixed reps, `NxA-B` rep range, trailing `s` for seconds (holds).

All descriptions and cues in this catalog are written in our own words. Step orders follow the commonly published progressions named per section; no text was copied.

## Recommended Routine ladders

Source: Step order follows the progressions in the r/bodyweightfitness Recommended Routine and its exercise wiki.

### rr_pullup - Pull-up progression

Pattern: pull, then weighted work

1. Scapular pull (`CAL_SCAPULAR_PULL`)
2. Arch hang (`CAL_ARCH_HANG`) - 3x10-30s
3. Pull-up negative (`CAL_PULLUP_NEGATIVE`)
4. Band-assisted pull-up (`CAL_PULLUP_BAND_ASSISTED`) - band
5. Pull-up (`CAL_PULLUP`)
6. L-sit pull-up (`CAL_LSIT_PULLUP`)

### rr_squat - Squat progression

Pattern: squat

1. Assisted squat (`CAL_ASSISTED_SQUAT`)
2. Bodyweight squat (`CAL_SQUAT`)
3. Split squat (`CAL_SPLIT_SQUAT`)
4. Bulgarian split squat (`CAL_BULGARIAN_SPLIT_SQUAT`)
5. Beginner shrimp squat (`CAL_SHRIMP_SQUAT_BEGINNER`)
6. Intermediate shrimp squat (`CAL_SHRIMP_SQUAT_INTERMEDIATE`)
7. Advanced shrimp squat (`CAL_SHRIMP_SQUAT_ADVANCED`)

### rr_dip - Dip progression

Pattern: push, then weighted work

1. Support hold (`CAL_SUPPORT_HOLD`) - 3x10-30s
2. Dip negative (`CAL_DIP_NEGATIVE`)
3. Dips (`DIPS`)

### rr_hinge - Hip hinge progression

Pattern: hinge

1. Bodyweight Romanian deadlift (`CAL_RDL_BODYWEIGHT`)
2. Single-leg deadlift (`CAL_SINGLE_LEG_DEADLIFT`)
3. Banded Nordic curl negative (`CAL_NORDIC_CURL_BANDED`)
4. Nordic curl (`CAL_NORDIC_CURL`)

### rr_row - Row progression

Pattern: pull

1. Vertical row (`CAL_ROW_VERTICAL`)
2. Incline row (`CAL_ROW_INCLINE`)
3. Horizontal row (`CAL_ROW_HORIZONTAL`)
4. Wide row (`CAL_ROW_WIDE`)
5. Archer row (`CAL_ROW_ARCHER`)

### rr_pushup - Push-up progression

Pattern: push, then weighted work

1. Wall push-up (`CAL_PUSHUP_WALL`)
2. Incline push-up (`CAL_PUSHUP_INCLINE`)
3. Push-up (`CAL_PUSHUP`)
4. Diamond push-up (`CAL_PUSHUP_DIAMOND`)
5. Pseudo planche push-up (`CAL_PUSHUP_PSEUDO_PLANCHE`)

### rr_antiextension - Anti-extension core progression

Pattern: core

1. Plank (`CAL_PLANK`) - 3x10-30s
2. Ring ab rollout (`CAL_RING_ROLLOUT`)
3. Ab wheel rollout (`CAL_AB_WHEEL_ROLLOUT`)

### rr_antirotation - Anti-rotation core

Pattern: core

1. Banded Pallof press (`CAL_PALLOF_PRESS_BANDED`)

### rr_extension - Back extension

Pattern: hinge

1. Reverse hyperextension (`CAL_REVERSE_HYPEREXTENSION`)

## Ten-step ladders

Source: Step order follows the widely used ten-step push-up, squat, pull-up, leg-raise, bridge and handstand push-up progressions of the classic bodyweight "big six" approach; schemes are our own ranges (easy steps 10-25 reps, hard steps 3-5).

### six_pushup - Ten-step push-up

Pattern: push

1. Wall push-up (`CAL_PUSHUP_WALL`) - 3x10-25
2. Incline push-up (`CAL_PUSHUP_INCLINE`) - 3x10-25
3. Kneeling push-up (`CAL_PUSHUP_KNEELING`) - 3x10-25
4. Half push-up (`CAL_PUSHUP_HALF`) - 3x8-15
5. Push-up (`CAL_PUSHUP`) - 3x8-15
6. Close push-up (`CAL_PUSHUP_CLOSE`) - 3x8-15
7. Uneven push-up (`CAL_PUSHUP_UNEVEN`) - 3x5-8
8. Half one-arm push-up (`CAL_PUSHUP_ONE_ARM_HALF`) - 3x5-8
9. Lever push-up (`CAL_PUSHUP_LEVER`) - 3x3-5
10. One-arm push-up (`CAL_PUSHUP_ONE_ARM`) - 3x3-5

### six_squat - Ten-step squat

Pattern: squat

1. Shoulderstand squat (`CAL_SQUAT_SHOULDERSTAND`) - 3x10-25
2. Jackknife squat (`CAL_SQUAT_JACKKNIFE`) - 3x10-25
3. Supported squat (`CAL_SQUAT_SUPPORTED`) - 3x10-25
4. Half squat (`CAL_SQUAT_HALF`) - 3x8-15
5. Bodyweight squat (`CAL_SQUAT`) - 3x8-15
6. Close squat (`CAL_SQUAT_CLOSE`) - 3x8-15
7. Uneven squat (`CAL_SQUAT_UNEVEN`) - 3x5-8
8. Half one-leg squat (`CAL_SQUAT_ONE_LEG_HALF`) - 3x5-8
9. Assisted pistol squat (`CAL_PISTOL_ASSISTED`) - 3x3-5
10. Pistol squat (`CAL_PISTOL`) - 3x3-5

### six_pullup - Ten-step pull-up

Pattern: pull

1. Vertical pull (`CAL_PULL_VERTICAL`) - 3x10-25
2. Horizontal row (`CAL_ROW_HORIZONTAL`) - 3x10-25
3. Jackknife pull-up (`CAL_PULLUP_JACKKNIFE`) - 3x10-25
4. Half pull-up (`CAL_PULLUP_HALF`) - 3x8-15
5. Pull-up (`CAL_PULLUP`) - 3x8-15
6. Close-grip pull-up (`CAL_PULLUP_CLOSE`) - 3x8-15
7. Uneven pull-up (`CAL_PULLUP_UNEVEN`) - 3x5-8
8. Half one-arm pull-up (`CAL_PULLUP_ONE_ARM_HALF`) - 3x5-8
9. Assisted one-arm pull-up (`CAL_PULLUP_ONE_ARM_ASSISTED`) - 3x3-5
10. One-arm pull-up (`CAL_PULLUP_ONE_ARM`) - 3x3-5

### six_legraise - Ten-step leg raise

Pattern: core

1. Lying knee tuck (`CAL_KNEE_TUCK_LYING`) - 3x10-25
2. Lying knee raise (`CAL_KNEE_RAISE_LYING`) - 3x10-25
3. Lying bent-leg raise (`CAL_LEG_RAISE_BENT_LYING`) - 3x10-25
4. Lying frog raise (`CAL_LEG_RAISE_FROG_LYING`) - 3x10-20
5. Lying straight-leg raise (`CAL_LEG_RAISE_LYING`) - 3x10-20
6. Hanging knee raise (`CAL_HANGING_KNEE_RAISE`) - 3x8-15
7. Hanging bent-leg raise (`CAL_HANGING_BENT_LEG_RAISE`) - 3x8-12
8. Hanging frog raise (`CAL_HANGING_FROG_RAISE`) - 3x8-12
9. Partial hanging straight-leg raise (`CAL_HANGING_LEG_RAISE_PARTIAL`) - 3x5-10
10. Hanging straight-leg raise (`CAL_HANGING_LEG_RAISE`) - 3x3-8

### six_bridge - Ten-step bridge

Pattern: core

1. Short bridge (`CAL_BRIDGE_SHORT`) - 3x10-25
2. Straight bridge (`CAL_BRIDGE_STRAIGHT`) - 3x10-25
3. Angled bridge (`CAL_BRIDGE_ANGLED`) - 3x10-20
4. Head bridge (`CAL_BRIDGE_HEAD`) - 3x8-15
5. Half bridge (`CAL_BRIDGE_HALF`) - 3x8-15
6. Full bridge (`CAL_BRIDGE`) - 3x8-15
7. Wall-walking bridge down (`CAL_BRIDGE_WALL_DOWN`) - 3x5-10
8. Wall-walking bridge up (`CAL_BRIDGE_WALL_UP`) - 3x5-10
9. Closing the bridge (`CAL_BRIDGE_CLOSING`) - 3x3-8
10. Stand-to-stand bridge (`CAL_BRIDGE_STAND_TO_STAND`) - 3x3-5

### six_hspu - Ten-step handstand push-up

Pattern: push

1. Wall headstand (`CAL_HEADSTAND_WALL`) - 3x10-30s
2. Crow stand (`CAL_CROW_STAND`) - 3x10-30s
3. Chest-to-wall handstand (`CAL_HANDSTAND_CHEST_TO_WALL`) - 3x20-60s
4. Half handstand push-up (`CAL_HSPU_HALF`) - 3x5-10
5. Handstand push-up (`CAL_HSPU`) - 3x5-8
6. Close handstand push-up (`CAL_HSPU_CLOSE`) - 3x5-8
7. Uneven handstand push-up (`CAL_HSPU_UNEVEN`) - 3x3-6
8. Half one-arm handstand push-up (`CAL_HSPU_ONE_ARM_HALF`) - 3x3-5
9. Lever handstand push-up (`CAL_HSPU_LEVER`) - 3x3-5
10. One-arm handstand push-up (`CAL_HSPU_ONE_ARM`) - 3x1-3

## Skill ladders

Source: Step order follows Steven Low's progression charts and the r/bodyweightfitness skill wiki pages; hold ranges are our own.

### skill_handstand - Handstand

Pattern: skill

1. Wall plank (`CAL_HANDSTAND_WALL_PLANK`) - 3x10-30s
2. Chest-to-wall handstand (`CAL_HANDSTAND_CHEST_TO_WALL`) - 3x20-60s
3. Handstand heel pull (`CAL_HANDSTAND_HEEL_PULL`) - 3x10-30s
4. Freestanding handstand (`CAL_HANDSTAND`) - 3x10-30s

### skill_lsit - L-sit

Pattern: skill

1. Foot-supported L-sit (`CAL_LSIT_FOOT_SUPPORTED`) - 3x10-30s
2. Tuck L-sit (`CAL_LSIT_TUCK`) - 3x10-30s
3. One-leg L-sit (`CAL_LSIT_ONE_LEG`) - 3x10-30s
4. L-sit (`CAL_LSIT`) - 3x10-30s

### skill_front_lever - Front lever

Pattern: skill

1. Tuck front lever (`CAL_FL_TUCK`) - 3x5-15s
2. Advanced tuck front lever (`CAL_FL_ADV_TUCK`) - 3x5-15s
3. One-leg front lever (`CAL_FL_ONE_LEG`) - 3x5-15s
4. Straddle front lever (`CAL_FL_STRADDLE`) - 3x3-10s
5. Front lever (`CAL_FL`) - 3x3-10s

### skill_planche - Planche

Pattern: skill

1. Planche lean (`CAL_PLANCHE_LEAN`) - 3x10-30s
2. Tuck planche (`CAL_PLANCHE_TUCK`) - 3x5-15s
3. Advanced tuck planche (`CAL_PLANCHE_ADV_TUCK`) - 3x5-15s
4. Straddle planche (`CAL_PLANCHE_STRADDLE`) - 3x3-10s

### skill_muscleup - Muscle-up

Pattern: skill

1. High pull-up (`CAL_PULLUP_HIGH`) - 3x3-8
2. Chest-to-bar pull-up (`CAL_PULLUP_CHEST_TO_BAR`) - 3x3-8
3. Band-assisted muscle-up (`CAL_MUSCLEUP_BAND`) - 3x3-5
4. Muscle-up (`CAL_MUSCLEUP`) - 3x1-3
