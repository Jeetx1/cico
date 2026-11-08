# Synthetic log for the tests: invented foods and days, no real data.
import json, random, datetime
random.seed(4)
foods = {
 'f1': dict(name='Skyr nature', brand='Test Dairy', barcode='7610200337535', unit='g', k=63, p=11, c=4, f=0.2, portion=dict(name='cup', g=170), fav=True, made='scan', created='2026-09-01T07:00:00Z'),
 'f2': dict(name='Oat flakes', brand='Mill & Co', barcode='7613035974685', unit='g', k=372, p=13.5, c=58.7, f=7, portion=None, fav=True, made='scan', created='2026-09-01T07:01:00Z'),
 'f3': dict(name='Chicken breast', brand='', barcode='', unit='g', k=110, p=23, c=0, f=1.8, portion=None, fav=False, made='manual', created='2026-09-01T12:00:00Z'),
 'f4': dict(name='Basmati rice, dry', brand='Rice Hill', barcode='4006381333931', unit='g', k=352, p=8.5, c=77, f=0.9, portion=None, fav=False, made='scan', created='2026-09-02T12:00:00Z'),
 'f5': dict(name='Whole milk', brand='Test Dairy', barcode='7617400030457', unit='ml', k=65, p=3.3, c=4.8, f=3.5, portion=dict(name='glass', g=250), fav=False, made='scan', created='2026-09-03T08:00:00Z'),
 'f6': dict(name='Banana', brand='', barcode='', unit='g', k=93, p=1.1, c=20, f=0.3, portion=dict(name='piece', g=120), fav=True, made='manual', created='2026-09-03T15:00:00Z'),
 'f7': dict(name='Dark chocolate 72%', brand='Choco Alp', barcode='7610032055058', unit='g', k=566, p=8, c=31, f=43, portion=dict(name='row', g=20), fav=False, made='scan', created='2026-09-05T20:00:00Z'),
 'f8': dict(name='Olive oil', brand='', barcode='', unit='ml', k=819, p=0, c=0, f=91, portion=dict(name='tbsp', g=10), fav=False, made='manual', created='2026-09-06T19:00:00Z'),
 'f9': dict(name='Wholegrain bread', brand='Bakery', barcode='7616500010222', unit='g', k=240, p=9, c=40, f=3.5, portion=dict(name='slice', g=45), fav=False, made='scan', created='2026-09-07T07:30:00Z'),
 'f10': dict(name='Whey protein vanilla', brand='Lift Lab', barcode='5000159407236', unit='g', k=380, p=78, c=6, f=5, portion=dict(name='scoop', g=30), fav=True, made='scan', created='2026-09-08T10:00:00Z'),
}
plan = [('Breakfast', 'f2', 80), ('Breakfast', 'f5', 250), ('Breakfast', 'f1', 170), ('Lunch', 'f3', 200), ('Lunch', 'f4', 90), ('Lunch', 'f8', 10),
        ('Snacks', 'f6', 120), ('Snacks', 'f10', 30), ('Dinner', 'f9', 135), ('Dinner', 'f3', 180), ('Dinner', 'f7', 20)]
days = {}
d = datetime.date(2026, 9, 1)
while d <= datetime.date(2026, 10, 14):
    if random.random() < .9:
        items = []
        for i, (meal, fid, g) in enumerate(plan):
            if random.random() < .82:
                f = foods[fid]
                items.append(dict(id='i%s%d' % (d.strftime('%m%d'), i), food=fid, name=f['name'], brand=f['brand'], g=round(g * random.uniform(.8, 1.25)), meal=meal,
                                  k=f['k'], p=f['p'], c=f['c'], f=f['f'], at=d.isoformat() + 'T12:00:00Z'))
        days[d.isoformat()] = dict(items=items)
    d += datetime.timedelta(days=1)
days['2026-09-20']['phase'] = 'surplus'
days['2026-09-20']['items'].append(dict(id='xs1', food=None, name='Birthday cake', brand='', g=450, meal='Snacks', k=410, p=5, c=48, f=21, at='2026-09-20T16:00:00Z'))
# bodyweight on most mornings, drifting down in the shred phase (own random stream: the days above stay as they were)
rw = random.Random(7)
weights, kg, d = {}, 81.0, datetime.date(2026, 9, 1)
while d <= datetime.date(2026, 10, 14):
    kg += (-.08 if d >= datetime.date(2026, 10, 5) else .01) + rw.uniform(-.25, .25)
    if rw.random() < .75:
        weights[d.isoformat()] = round(kg, 1)
    d += datetime.timedelta(days=1)
weights['2026-10-14'] = 79.6
data = dict(app='calorie-tracker', v=1, saved='2026-10-14T08:00:00Z',
  config=dict(name='Test Person', targets=dict(maintain=dict(kcal=2600, protein=160, carbs=None, fat=None), shred=dict(kcal=2250, protein=170, carbs=None, fat=None), surplus=dict(kcal=4600, protein=160, carbs=None, fat=None)),
              phaseFrom=[dict(**{'from': '2026-09-01', 'phase': 'maintain'}), dict(**{'from': '2026-10-05', 'phase': 'shred'})]),
  foods=foods, days=days, weights=weights, futureField={'kept': True})
json.dump(data, open('tests/fixture.json', 'w'), indent=1)
print(len(days), 'days')
