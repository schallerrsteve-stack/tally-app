"""Build public/data/exercises.json from free-exercise-db (public domain, github.com/yuhonas/free-exercise-db).
Usage: python3 scripts/build-exercises.py path/to/exercises.json
Output rows: {id, n:name, g:group, k:kind (w|bw|t|c), eq, lv, pm:[primary], sm:[secondary], ins:[steps], img:[paths]}
`link` maps Tally's built-in exercise ids to their dataset match (for photos + instructions); those dataset rows are
marked dup so the picker doesn't list the same exercise twice."""
import json, sys
src = json.load(open(sys.argv[1]))
LINK = {'bench':'Barbell_Bench_Press_-_Medium_Grip','inclinedb':'Incline_Dumbbell_Press','dbbench':'Dumbbell_Bench_Press','pushup':'Pushups',
 'chestfly':'Cable_Crossover','dips':'Dips_-_Chest_Version','ohp':'Standing_Military_Press','dbshoulder':'Dumbbell_Shoulder_Press',
 'latraise':'Side_Lateral_Raise','facepull':'Face_Pull','deadlift':'Barbell_Deadlift','pullup':'Pullups','chinup':'Chin-Up',
 'latpull':'Wide-Grip_Lat_Pulldown','bbrow':'Bent_Over_Barbell_Row','dbrow':'One-Arm_Dumbbell_Row','cablerow':'Seated_Cable_Rows',
 'squat':'Barbell_Full_Squat','frontsquat':'Front_Barbell_Squat','gobletsquat':'Goblet_Squat','legpress':'Leg_Press',
 'rdl':'Romanian_Deadlift','lunge':'Barbell_Walking_Lunge','bss':'Split_Squat_with_Dumbbells','legext':'Leg_Extensions',
 'legcurl':'Lying_Leg_Curls','calf':'Standing_Calf_Raises','hipthrust':'Barbell_Hip_Thrust','kbswing':'One-Arm_Kettlebell_Swings',
 'curl':'Dumbbell_Bicep_Curl','hammer':'Hammer_Curls','pushdown':'Triceps_Pushdown','skull':'EZ-Bar_Skullcrusher','plank':'Plank',
 'sideplank':'Side_Bridge','crunch':'Crunches','legraise':'Hanging_Leg_Raise','twist':'Russian_Twist','run':'Running_Treadmill',
 'walk':'Walking_Treadmill','bike':'Bicycling_Stationary','row':'Rowing_Stationary','elliptical':'Elliptical_Trainer',
 'stairs':'Stairmaster','rope':'Rope_Jumping'}
GROUP = {'chest':'Chest','shoulders':'Shoulders','traps':'Shoulders','lats':'Back','middle back':'Back','lower back':'Back',
 'quadriceps':'Legs','hamstrings':'Legs','calves':'Legs','adductors':'Legs','abductors':'Legs','glutes':'Glutes',
 'biceps':'Arms','triceps':'Arms','forearms':'Arms','abdominals':'Core','neck':'Neck'}
dups = set(LINK.values()); out = []
for x in src:
    cat, eq = x['category'], x.get('equipment') or 'other'
    pm = x.get('primaryMuscles') or []
    k = 'c' if cat == 'cardio' else 't' if cat == 'stretching' or eq == 'foam roll' else 'bw' if eq == 'body only' else 'w'
    g = 'Cardio' if cat == 'cardio' else 'Stretching' if cat == 'stretching' else GROUP.get(pm[0] if pm else '', 'Full body')
    row = {'id': 'fx:' + x['id'], 'n': x['name'], 'g': g, 'k': k, 'eq': eq, 'lv': x.get('level') or '', 'pm': pm,
           'sm': x.get('secondaryMuscles') or [], 'ins': x.get('instructions') or [], 'img': x.get('images') or []}
    if x['id'] in dups: row['dup'] = 1
    out.append(row)
json.dump({'source': 'free-exercise-db (public domain) https://github.com/yuhonas/free-exercise-db',
           'imgBase': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/',
           'link': {k: 'fx:' + v for k, v in LINK.items()}, 'list': out},
          open('public/data/exercises.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(out), 'exercises,', len(LINK), 'linked')
